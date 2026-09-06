# Smart Attendance System

> **An AI-powered, browser-based attendance management system that combines facial recognition, randomized liveness verification, and voice OTP authentication to provide a secure and automated attendance workflow.**

<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-ES6+-yellow?style=for-the-badge&logo=javascript&logoColor=white" />
  <img src="https://img.shields.io/badge/Face--API.js-Computer%20Vision-blue?style=for-the-badge" />
  <img src="https://img.shields.io/badge/HTML5-Frontend-orange?style=for-the-badge&logo=html5&logoColor=white" />
  <img src="https://img.shields.io/badge/CSS3-Responsive-blue?style=for-the-badge&logo=css3&logoColor=white" />
  <img src="https://img.shields.io/badge/PHP-Email%20Reporting-777BB4?style=for-the-badge&logo=php&logoColor=white" />
</p>

---

## 📌 Overview

Traditional attendance systems can be time-consuming and may allow **proxy attendance** when authentication relies only on manual verification or static identity checks.

The **Smart Attendance System** addresses this by combining multiple verification layers:

**Face Recognition → Random Liveness Challenge → Voice OTP → Attendance**

The system first identifies a registered student through facial recognition, then asks the student to perform a randomly selected action such as blinking, turning the head, looking up/down, or smiling. After successful liveness verification, a voice-based OTP provides an additional authentication layer before attendance is marked.

---

## ✨ Key Features

### 🤖 AI-Based Face Recognition

* Real-time face detection using **Face-API.js**
* 68-point facial landmark detection
* Face descriptor generation and comparison
* Configurable face matching threshold
* Unknown face detection

### 🛡️ Challenge-Based Liveness Detection

A random challenge is generated for every verification session:

* 👁️ Blink 3 times
* ⬅️ Turn face LEFT
* ➡️ Turn face RIGHT
* ⬆️ Look UP
* ⬇️ Look DOWN
* 😊 Smile

Blink verification uses an **eye-state transition approach** rather than simply counting closed-eye frames:

```text
OPEN → CLOSED → OPEN = 1 BLINK
```

This helps avoid false counting during prolonged eye closure.

### 🔐 Voice OTP Verification

* Random 3-digit OTP generation
* Browser-based speech recognition
* Supports spoken digits and number words
* OTP validation before attendance confirmation
* Timeout and retry handling

### 🚫 Anti-Spoofing / Proxy Detection

The system includes challenge-response verification and eye-state monitoring to make simple photo-based proxy attempts more difficult.

### 📊 Real-Time Attendance Dashboard

* Total students
* Present students
* Absent students
* Attendance percentage
* Live verification status
* Check-in timestamp
* Liveness status
* Challenge type

### 📁 Attendance Reporting

* CSV attendance export
* Attendance report generation
* Email report endpoint using PHP

---

## 🧠 System Workflow

```text
                    ┌─────────────────┐
                    │   Camera Feed   │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Face Detection  │
                    └────────┬────────┘
                             │
                             ▼
                   ┌──────────────────┐
                   │ Face Recognition │
                   └────────┬─────────┘
                            │
                      Registered?
                       /       \
                     No         Yes
                     │           │
                     ▼           ▼
                  Unknown   Identity Lock
                                │
                                ▼
                       Random Challenge
                                │
              ┌─────────────────┼─────────────────┐
              │        │        │        │        │
            Blink    Left    Right      Up      Down
              │        │        │        │        │
              └──────────────┬────────────────────┘
                             │
                             ▼
                    Liveness Verified
                             │
                             ▼
                       Voice OTP Check
                             │
                             ▼
                       OTP Verified
                             │
                             ▼
                    Attendance Marked
                             │
                             ▼
                    Generate Report
```

---

## 🏗️ Technical Architecture

```text
┌──────────────────────────────────────────┐
│              Frontend Layer              │
│         HTML + CSS + JavaScript          │
└─────────────────────┬────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────┐
│          Computer Vision Layer           │
│              Face-API.js                 │
│                                          │
│ • Tiny Face Detector                     │
│ • Face Landmarks                         │
│ • Face Recognition                       │
└─────────────────────┬────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────┐
│          Liveness Verification           │
│                                          │
│ • Blink Detection                        │
│ • Head Movement                          │
│ • Eye Direction                          │
│ • Smile Detection                        │
└─────────────────────┬────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────┐
│         Voice Authentication             │
│            Web Speech API                │
└─────────────────────┬────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────┐
│          Attendance Management           │
│                                          │
│ • Attendance Status                      │
│ • Timestamp                              │
│ • Statistics                             │
│ • CSV Export                             │
│ • Email Reporting                        │
└──────────────────────────────────────────┘
```

---

## 🛠️ Technology Stack

| Layer                   | Technology               |
| ----------------------- | ------------------------ |
| Frontend                | HTML5, CSS3, JavaScript  |
| Computer Vision         | Face-API.js              |
| Face Detection          | Tiny Face Detector       |
| Facial Landmarks        | Face Landmark 68         |
| Face Recognition        | Face Descriptor Matching |
| Voice Authentication    | Web Speech API           |
| Reporting               | JavaScript CSV Export    |
| Email Service           | PHP                      |
| Development Environment | Visual Studio Code       |

---

## ⚙️ Recognition Configuration

The project uses a configurable face-matching threshold.

```javascript
const FACE_MATCH_THRESHOLD = 0.45;
```

The liveness system uses facial landmarks and an Eye Aspect Ratio (EAR)-based blink state transition:

```text
Open Eye
   ↓
Closed Eye
   ↓
Open Eye
   ↓
Blink Completed
```

For three-blink verification:

```text
Blink 1 ✓
Blink 2 ✓
Blink 3 ✓
     ↓
Challenge Verified
```

---

## 📂 Project Structure

```text
Smart-Attendance-System/
│
├── index.html
├── style.css
├── app.js
├── face-api.min.js
│
├── models/
│   ├── tiny_face_detector_model-shard1
│   ├── tiny_face_detector_model-weights_manifest.json
│   ├── face_landmark_68_model-shard1
│   ├── face_landmark_68_model-weights_manifest.json
│   ├── face_recognition_model-shard1
│   └── face_recognition_model-weights_manifest.json
│
├── dataset/
│   └── Student_Name_1.jpg
│
└── send_report.php
```

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/Aditi6789/Smart-Attendance-System.git
cd Smart-Attendance-System
```

### 2. Configure Student Data

Add the registered student's image to:

```text
dataset/
```

Example:

```text
dataset/Aditi Jain_1.jpg
```

Then configure the student information in `app.js`.

```javascript
const allPersonnel = [
    {
        name: "Aditi Jain",
        empId: "0608CS231011"
    }
];
```

### 3. Verify Model Files

Make sure the required Face-API.js model files are available inside:

```text
models/
```

### 4. Run the Application

Use a local development server such as **VS Code Live Server**.

> Camera and microphone permissions must be enabled in the browser.

---

## 🖥️ Application Screens

### Live Attendance Dashboard

*Add your project screenshot here.*

```text
docs/screenshots/dashboard.png
```

### Liveness Challenge

*Add a screenshot showing the random challenge UI here.*

```text
docs/screenshots/liveness.png
```

### Attendance Report

*Add a screenshot of the attendance table/report here.*

```text
docs/screenshots/report.png
```

---

## 🔍 Challenges Solved

### Face Recognition During User Movement

A single static face-recognition check can become unreliable when the user changes head orientation. The application therefore separates **identity recognition** from **liveness action verification** so that head movement can be evaluated through facial landmarks.

### Reliable Blink Detection

A naive implementation can count multiple frames of one closed eye as multiple blinks.

The improved approach detects:

```text
OPEN → CLOSED → OPEN
```

and increments the blink counter only after a complete eye-state transition.

### Multi-Step Verification

Instead of relying only on facial recognition, the system uses:

```text
Identity
   +
Liveness Challenge
   +
Voice OTP
```

This creates a layered authentication workflow.

---

## 🔒 Security Considerations

The project is designed as an academic and prototype implementation of multi-step attendance verification.

The liveness layer uses **challenge-response actions and facial landmarks** rather than claiming certified biometric anti-spoofing security.

For production deployment, additional controls such as secure backend storage, encrypted biometric data handling, HTTPS, access control, audit logging, and stronger presentation-attack detection would be required.

---

## 📈 Future Improvements

* Multiple reference images per student
* Backend database integration
* Secure authentication and role-based access
* Advanced presentation-attack detection
* Attendance history and analytics dashboard
* Admin panel for student management
* Cloud deployment
* Mobile-responsive optimization
* Automated scheduled attendance reports

---

## 🎯 Project Objective

The objective of this project is to demonstrate the practical integration of:

**Computer Vision + Facial Recognition + Liveness Detection + Voice Authentication + Web Technologies**

into a real-world attendance management workflow.

---

## 👩‍💻 Developer

**Aditi Jain**

Computer Science & Engineering
Final Year Project — 2026

---

## ⭐ Why This Project?

This project demonstrates practical experience with:

* JavaScript application development
* Computer vision integration
* Facial landmark processing
* State-based event detection
* Browser APIs
* Authentication workflows
* Real-time UI updates
* Data export and reporting
* Debugging and performance-oriented development

---

## 📄 License

This project is developed for **educational and academic purposes**.
