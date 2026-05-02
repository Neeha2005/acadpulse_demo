import React from 'react';

export default function Courses() {
  return (
    <div className="dashboard-scroll">
      <div className="hero-stats">
        <div className="welcome-text">
          <h1>Active Courses</h1>
          <p>Filter tasks and messages strictly tied to these monitored blocks.</p>
        </div>
      </div>
      
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title"><i className="fa-solid fa-book text-primary"></i> Course Roster</h2>
        </div>
        <div className="modal-body">
            <div className="stats-grid">
               <div className="stat-card">
                  <h3 className="stat-value" style={{fontSize: 22}}>Deep Learning</h3>
                  <p className="stat-label">CS 401</p>
               </div>
               <div className="stat-card">
                  <h3 className="stat-value" style={{fontSize: 22}}>Software Eng</h3>
                  <p className="stat-label">SE 301</p>
               </div>
               <div className="stat-card">
                  <h3 className="stat-value" style={{fontSize: 22}}>Applied Calculus</h3>
                  <p className="stat-label">MATH 201</p>
               </div>
            </div>
        </div>
      </div>
    </div>
  );
}
