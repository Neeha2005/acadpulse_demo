import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import acadPulseLogo from "./assets/acadpulse-logo.png";
import "./styles.css";

const pages = [
  { id: "overview", title: "Today's Overview", icon: "home" },
  { id: "assignments", title: "Assignments & Quizzes", icon: "tasks", alert: true },
  { id: "announcements", title: "Announcements", icon: "bell" },
  { id: "events", title: "Events", icon: "calendar" },
  { id: "timetable", title: "Weekly Timetable", icon: "clock" },
];

const tasks = [
  {
    course: "Operating Systems",
    type: "Assignment",
    title: "Lab report 4 - Memory Management submit karo",
    meta: "WhatsApp - Due 11:59 PM tonight",
    priority: "Critical",
    icon: "doc",
    color: "rose",
  },
  {
    course: "NLP",
    type: "Quiz",
    title: "Quiz 3 - chapter 5 se, attention mechanisms",
    meta: "Google Classroom - Today 2:00 PM",
    priority: "Critical",
    icon: "clip",
    color: "violet",
  },
  {
    course: "Deep Learning",
    type: "Assignment",
    title: "Assignment 2 - CNN implementation, deadline Sunday raat tak",
    meta: "Gmail - Due Sunday 11:59 PM",
    priority: "High",
    icon: "folder",
    color: "orange",
  },
  {
    course: "Database Systems",
    type: "Exam Schedule",
    title: "Date sheet out - Finals start December 10, DB on 14th",
    meta: "Gmail - 3 hours ago",
    priority: "Medium",
    icon: "pin",
    color: "gold",
  },
];

const assignments = [
  {
    course: "Operating Systems",
    type: "Assignment",
    title: "Lab report 4 - Memory Management",
    meta: "Due tonight - WhatsApp",
    priority: "Critical",
    done: true,
    icon: "doc",
    color: "rose",
  },
  {
    course: "NLP",
    type: "Quiz",
    title: "Quiz 3 - Attention mechanisms, chapter 5",
    meta: "Today 2:00 PM - Classroom",
    priority: "Critical",
    done: true,
    icon: "clip",
    color: "violet",
  },
  {
    course: "Deep Learning",
    type: "Assignment",
    title: "CNN implementation - Assignment 2",
    meta: "Due Sunday - Gmail",
    priority: "High",
    done: true,
    icon: "laptop",
    color: "orange",
  },
  {
    course: "DSA",
    type: "Assignment",
    title: "Lab 3 - Graph traversal BFS/DFS",
    meta: "Completed - 2 days ago",
    priority: "Done",
    done: true,
    icon: "check",
    color: "green",
    muted: true,
  },
];

const announcements = [
  {
    title: "Class cancel hai kal - sir out of town",
    meta: "DSA - WhatsApp - 5 hours ago",
    accent: "blue",
  },
  {
    title: "Venue change - NLP lecture now in Room 204 kal se",
    meta: "NLP - WhatsApp - Yesterday",
    accent: "purple",
  },
  {
    title: "Date sheet released - Finals start December 10",
    meta: "DB Systems - Gmail - Yesterday",
    accent: "yellow",
  },
  {
    title: "Semester calendar updated on Classroom - check for holiday schedule",
    meta: "All Courses - Classroom - 2 days ago",
    accent: "green",
  },
  {
    title: "OS quiz postponed - next Tuesday instead of Friday",
    meta: "Operating Systems - WhatsApp - 3 days ago",
    accent: "orange",
  },
];

const events = [
  {
    date: "Thu Nov 21 - SOFTEC Society",
    title: "Speed Programming Competition - Open Registration",
    body: "Registration open hai abhi - last date Sunday. Team of 2-3. Venue: CS Block Lab 3. Registration form link send kiya hai CR ne group mein.",
  },
  {
    date: "Fri Nov 22 - Career Society",
    title: "Career Fair 2024 - Tech & Startups",
    body: "10 companies aa rahi hain including Systems Ltd, Arbisoft, 10Pearls. CV update karo. Entry free for students with valid ID card. Hall A, 10 AM - 4 PM.",
  },
  {
    date: "Mon Nov 25 - Dramatics Society",
    title: "Annual Drama Night - Ticket Sales Open",
    body: "Tickets Rs. 500 available at CS reception. Limited seats. This year ka theme Duality. Auditorium, 6 PM.",
  },
];

const schedule = {
  "9 AM": { Mon: "OS\nR204", Wed: "OS\nR204" },
  "11 AM": { Tue: "NLP\nR101", Thu: "NLP\nR101" },
  "2 PM": { Mon: "DL\nLab 2", Thu: "DL\nLab 2" },
  "4 PM": { Tue: "DSA\nR302", Thu: "DSA\nR302", Fri: "DB\nR110" },
};

const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function App() {
  const [activePage, setActivePage] = useState("overview");
  const active = pages.find((page) => page.id === activePage) || pages[0];

  return (
    <div className="app-frame">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand-mark">
          <img src={acadPulseLogo} alt="AcadPulse" />
        </div>
        <nav className="nav-list">
          {pages.map((page) => (
            <button
              className={`nav-button ${activePage === page.id ? "active" : ""}`}
              key={page.id}
              type="button"
              title={page.title}
              onClick={() => setActivePage(page.id)}
            >
              <Icon name={page.icon} />
              {page.alert ? <span className="nav-alert" aria-hidden="true" /> : null}
            </button>
          ))}
        </nav>
        <div className="profile-mark">AH</div>
      </aside>

      <main className="content-shell">
        <header className="topbar">
          <h1>{active.title}</h1>
          <div className="filters" aria-label="Priority filters">
            <button className="filter active" type="button">All</button>
            <button className="filter" type="button">Critical</button>
            <button className="filter" type="button">Medium</button>
          </div>
        </header>
        <section className="page-body">
          <PageContent page={activePage} />
        </section>
      </main>

      <AcadBot />
    </div>
  );
}

function PageContent({ page }) {
  if (page === "assignments") {
    return <AssignmentsPage />;
  }

  if (page === "announcements") {
    return <AnnouncementsPage />;
  }

  if (page === "events") {
    return <EventsPage />;
  }

  if (page === "timetable") {
    return <TimetablePage />;
  }

  return <OverviewPage />;
}

function OverviewPage() {
  return (
    <>
      <div className="overview-grid">
        <div className="stat-grid">
          <Metric label="Due today" value="3" detail="2 critical" tone="red" />
          <Metric label="This week" value="8" detail="across 4 courses" tone="yellow" />
          <Metric label="Pending" value="14" detail="5 assignments" tone="blue" />
          <Metric label="Completed" value="27" detail="this semester" tone="green" />
        </div>
        <article className="image-card">
          <img
            src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=900&q=80"
            alt="Students studying together on campus"
          />
          <div>
            <p>Campus pulse</p>
            <h2>Academic updates in one calm place</h2>
          </div>
        </article>
      </div>
      <SectionTitle label="Urgent - Today" action="See all" />
      <div className="stack">
        {tasks.map((task) => (
          <TaskCard key={task.title} task={task} />
        ))}
      </div>
    </>
  );
}

function AssignmentsPage() {
  return (
    <>
      <SectionTitle label="Assignments & Quizzes">
        <select className="course-select" defaultValue="all">
          <option value="all">All Courses</option>
          <option value="os">Operating Systems</option>
          <option value="nlp">NLP</option>
          <option value="dl">Deep Learning</option>
        </select>
      </SectionTitle>
      <div className="stack">
        {assignments.map((task) => (
          <TaskCard key={task.title} task={task} showDone />
        ))}
      </div>
    </>
  );
}

function AnnouncementsPage() {
  return (
    <>
      <SectionTitle label="Announcements" />
      <div className="announcement-stack">
        {announcements.map((item) => (
          <article className={`announcement-card ${item.accent}`} key={item.title}>
            <h2>{item.title}</h2>
            <p>{item.meta}</p>
          </article>
        ))}
      </div>
    </>
  );
}

function EventsPage() {
  return (
    <>
      <SectionTitle label="Events & Societies" />
      <div className="event-stack">
        {events.map((event) => (
          <article className="event-card" key={event.title}>
            <p className="event-date">{event.date}</p>
            <h2>{event.title}</h2>
            <p>{event.body}</p>
          </article>
        ))}
      </div>
    </>
  );
}

function TimetablePage() {
  const rows = useMemo(() => Object.entries(schedule), []);

  return (
    <>
      <SectionTitle label="Weekly Schedule" action="+ Add Class" />
      <div className="timetable">
        <div className="time heading">Time</div>
        {days.map((day) => (
          <div className="heading" key={day}>{day}</div>
        ))}
        {rows.map(([time, classes]) => (
          <React.Fragment key={time}>
            <div className="time">{time}</div>
            {days.map((day) => (
              <div className="slot" key={`${time}-${day}`}>
                {classes[day] ? <ClassBlock text={classes[day]} /> : null}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </>
  );
}

function Metric({ label, value, detail, tone }) {
  return (
    <article className="metric-card">
      <p>{label}</p>
      <strong className={tone}>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}

function SectionTitle({ label, action, children }) {
  return (
    <div className="section-title">
      <p>{label}</p>
      {children || (action ? <button type="button">{action}</button> : null)}
    </div>
  );
}

function TaskCard({ task, showDone = false }) {
  return (
    <article className={`task-card ${task.muted ? "muted" : ""}`}>
      <div className={`task-icon ${task.color}`}>
        <Icon name={task.icon} />
      </div>
      <div className="task-copy">
        <div className="task-tags">
          <span>{task.course}</span>
          <span className="outline-tag">{task.type}</span>
        </div>
        <h2>{task.title}</h2>
        <p>{task.meta}</p>
      </div>
      <div className="task-actions">
        <PriorityPill priority={task.priority} />
        {showDone && task.done ? <span className="done-pill">Done</span> : null}
      </div>
    </article>
  );
}

function PriorityPill({ priority }) {
  return <span className={`priority ${priority.toLowerCase()}`}>{priority}</span>;
}

function ClassBlock({ text }) {
  const [name, room] = text.split("\n");
  return (
    <div className={`class-block ${name.toLowerCase()}`}>
      <strong>{name}</strong>
      <span>{room}</span>
    </div>
  );
}

function AcadBot() {
  const [draft, setDraft] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { id: 1, from: "bot", content: "Salam! Main tumhara AcadBot hun. Kya help chahiye?" },
    { id: 2, from: "user", content: "Is hafte kya kya submit karna hai?" },
    {
      id: 3,
      from: "bot",
      content: (
        <>
          <strong>Is hafte 3 deadlines hain:</strong>
          <br />
          <span className="dot red" /> OS Lab Report - aaj raat
          <br />
          <span className="dot red" /> NLP Quiz 3 - aaj 2 PM
          <br />
          <span className="dot orange" /> DL Assignment 2 - Sunday
        </>
      ),
    },
    { id: 4, from: "bot", content: "Done - OS Lab Report 4 completed. Badhiya kaam!" },
  ]);

  function handleSubmit(event) {
    event.preventDefault();
    const message = draft.trim();

    if (!message) {
      return;
    }

    setChatMessages((currentMessages) => [
      ...currentMessages,
      { id: Date.now(), from: "user", content: message },
      {
        id: Date.now() + 1,
        from: "bot",
        content: "Samajh gaya. Backend chatbot connect hota hi main live data se jawab dunga.",
      },
    ]);
    setDraft("");
  }

  return (
    <aside className="chat-panel" aria-label="AcadBot chat">
      <header className="bot-header">
        <div className="bot-avatar">
          <img src={acadPulseLogo} alt="" />
        </div>
        <div>
          <h2>AcadBot</h2>
          <p><span /> Online</p>
        </div>
      </header>
      <div className="chat-scroll">
        {chatMessages.map((message) => (
          <Bubble from={message.from} key={message.id}>{message.content}</Bubble>
        ))}
        <button className="chat-action" type="button">Mark OS assignment as done</button>
      </div>
      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          aria-label="Message AcadBot"
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask AcadBot..."
          value={draft}
        />
        <button type="submit">Send</button>
      </form>
    </aside>
  );
}

function Bubble({ from, children }) {
  return <div className={`bubble ${from}`}>{children}</div>;
}

function Icon({ name }) {
  const icons = {
    home: "H",
    tasks: "T",
    bell: "!",
    calendar: "C",
    clock: "O",
    doc: "D",
    clip: "#",
    folder: "F",
    pin: "P",
    laptop: "L",
    check: "OK",
  };

  return <span className="icon" aria-hidden="true">{icons[name] || "*"}</span>;
}

createRoot(document.getElementById("root")).render(<App />);
