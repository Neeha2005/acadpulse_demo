"""
Fine-tune XLM-RoBERTa for AcadPulse notification classification.

Expected dataset columns:
    text,label

Allowed labels:
    announcement, assignment, event, quiz, noise

Typical Colab usage:
    !python ai/classifier/train_xlm_roberta.py \
        --dataset ai/dataset/labeled_messages.csv \
        --output ai/classifier/model \
        --epochs 3
"""

import argparse
import json
from pathlib import Path

import evaluate
import numpy as np
from datasets import load_dataset
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    DataCollatorWithPadding,
    Trainer,
    TrainingArguments,
)


LABELS = ["announcement", "assignment", "event", "quiz", "noise"]
LABEL_TO_ID = {label: index for index, label in enumerate(LABELS)}
ID_TO_LABEL = {index: label for label, index in LABEL_TO_ID.items()}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", required=True, help="CSV file with text,label columns")
    parser.add_argument("--output", default="ai/classifier/model", help="Saved model directory")
    parser.add_argument("--base-model", default="xlm-roberta-base", help="Base Hugging Face model")
    parser.add_argument("--epochs", type=float, default=3)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--learning-rate", type=float, default=2e-5)
    parser.add_argument("--max-length", type=int, default=256)
    parser.add_argument("--test-size", type=float, default=0.15)
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args()


def normalize_label(value):
    label = str(value).strip().lower().replace("-", "_").replace(" ", "_")
    if label not in LABEL_TO_ID:
        raise ValueError(f"Unsupported label: {value}. Expected one of {LABELS}")
    return LABEL_TO_ID[label]


def main():
    args = parse_args()
    dataset_path = Path(args.dataset)
    output_dir = Path(args.output)
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset not found: {dataset_path}")

    raw_dataset = load_dataset("csv", data_files=str(dataset_path))["train"]
    raw_dataset = raw_dataset.map(
        lambda row: {"labels": normalize_label(row["label"])},
        remove_columns=["label"],
    )
    split_dataset = raw_dataset.train_test_split(test_size=args.test_size, seed=args.seed)

    tokenizer = AutoTokenizer.from_pretrained(args.base_model)

    def preprocess(batch):
        encoded = tokenizer(
            batch["text"],
            truncation=True,
            max_length=args.max_length,
        )
        return encoded

    tokenized = split_dataset.map(preprocess, batched=True)
    model = AutoModelForSequenceClassification.from_pretrained(
        args.base_model,
        num_labels=len(LABELS),
        id2label=ID_TO_LABEL,
        label2id=LABEL_TO_ID,
    )
    accuracy = evaluate.load("accuracy")
    f1_metric = evaluate.load("f1")

    def compute_metrics(eval_prediction):
        logits, labels = eval_prediction
        predictions = np.argmax(logits, axis=-1)
        return {
            "accuracy": accuracy.compute(predictions=predictions, references=labels)["accuracy"],
            "f1_macro": f1_metric.compute(predictions=predictions, references=labels, average="macro")["f1"],
        }

    training_args = TrainingArguments(
        output_dir=str(output_dir.parent / "runs"),
        eval_strategy="epoch",
        save_strategy="epoch",
        learning_rate=args.learning_rate,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        num_train_epochs=args.epochs,
        weight_decay=0.01,
        load_best_model_at_end=True,
        metric_for_best_model="f1_macro",
        greater_is_better=True,
        logging_steps=20,
        seed=args.seed,
        report_to="none",
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized["train"],
        eval_dataset=tokenized["test"],
        tokenizer=tokenizer,
        data_collator=DataCollatorWithPadding(tokenizer=tokenizer),
        compute_metrics=compute_metrics,
    )

    trainer.train()
    metrics = trainer.evaluate()

    output_dir.mkdir(parents=True, exist_ok=True)
    trainer.save_model(str(output_dir))
    tokenizer.save_pretrained(str(output_dir))

    metadata = {
        "base_model": args.base_model,
        "labels": LABELS,
        "label2id": LABEL_TO_ID,
        "id2label": ID_TO_LABEL,
        "metrics": metrics,
        "dataset_file": str(dataset_path),
    }
    (output_dir / "acadpulse_model_metadata.json").write_text(
        json.dumps(metadata, indent=2),
        encoding="utf-8",
    )
    print(f"Saved fine-tuned model to {output_dir.resolve()}")


if __name__ == "__main__":
    main()
