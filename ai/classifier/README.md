# AcadPulse XLM-RoBERTa Classifier

This folder completes tasks `#12` and `#13`.

## Labels

The fine-tuned model predicts:

- `announcement`
- `assignment`
- `event`
- `quiz`
- `noise`

## Dataset Format

Create a private CSV at `ai/dataset/labeled_messages.csv`.

```csv
text,label
"Assignment 2 is due tomorrow at 11:59 PM",assignment
"Quiz will be held in next class",quiz
"Slides for lecture 4 are uploaded",announcement
```

The dataset folder is gitignored because WhatsApp/email data can contain private student messages.

## Fine-Tune

Install training dependencies in Colab or a local GPU environment:

```bash
pip install -U "transformers>=4.40" "datasets>=2.18" "evaluate>=0.4" "accelerate>=0.29" scikit-learn
```

Run:

```bash
python ai/classifier/train_xlm_roberta.py \
  --dataset ai/dataset/labeled_messages.csv \
  --output ai/classifier/model \
  --epochs 3
```

## Saved Model

The script saves the fine-tuned model to:

```text
ai/classifier/model/
```

That directory is intentionally gitignored because model weights are too large for GitHub. To use the model in FastAPI, keep the folder on the deployment machine or set:

```bash
LOCAL_CLASSIFIER_PATH=/absolute/path/to/ai/classifier/model
LOCAL_CLASSIFIER_MIN_CONFIDENCE=0.65
```

FastAPI now loads this local model lazily. If the model folder is missing, the app keeps using the existing fallbacks.
