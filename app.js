
document.addEventListener("DOMContentLoaded", () => {

    console.log("CIG Smart Attendance System - Liveness Detection Started");

    /* =========================================================
       DOM ELEMENTS
    ========================================================= */

    const video = document.getElementById("video");
    const overlay = document.getElementById("overlay");

    const statusText = document.getElementById("statusText");
    const attendanceList = document.getElementById("attendanceList");

    const dateText = document.getElementById("dateText");
    const speechText = document.getElementById("speechText");

    const challengeBox = document.getElementById("challengeBox");
    const challengeTextEl = document.getElementById("challengeText");
    const challengeIconEl = document.getElementById("challengeIcon");
    const challengeStatusEl = document.getElementById("challengeStatus");

    const otpBox = document.getElementById("otpBox");
    const otpValue = document.getElementById("otpValue");
    const micStatus = document.getElementById("micStatus");

    const totalPersonnelEl = document.getElementById("totalPersonnel");
    const totalPresentEl = document.getElementById("totalPresent");
    const totalAbsentEl = document.getElementById("totalAbsent");

    const progressBar = document.getElementById("progressBar");
    const progressPercent = document.getElementById("progressPercent");


    /* =========================================================
       STUDENT DATABASE
    ========================================================= */

    const allPersonnel = [
        {
            name: "Aditi Jain",
            empId: "0608CS231011"
        }

        // Add more students like:
        // {
        //     name: "Rahul",
        //     empId: "CIG2026002"
        // }
    ];


    /* =========================================================
       GLOBAL VARIABLES
    ========================================================= */

    let faceMatcher = null;

    let markedAttendance = [];

    let isProcessing = false;

    let cameraStream = null;

    const studentStates = {};


    /* =========================================================
       SETTINGS
    ========================================================= */

    const FACE_MATCH_THRESHOLD = 0.45;

    const DETECTION_INTERVAL = 250;

    const CHALLENGE_TIMEOUT = 20000;

    /*
       Blink detection uses two thresholds.

       EAR <= 0.21
       -> eye closed

       EAR >= 0.24
       -> eye open

       This prevents noisy switching.
    */

    const EAR_CLOSED = 0.21;
    const EAR_OPEN = 0.24;

    const MIN_BLINK_DURATION = 50;

    const MAX_EYES_CLOSED_TIME = 2500;

    const MIN_TIME_BETWEEN_BLINKS = 250;


    /* =========================================================
       RANDOM CHALLENGES
    ========================================================= */

    const challenges = [
        "blink3",
        "left",
        "right",
        "up",
        "down",
        "smile"
    ];


    const challengeInstructions = {

        blink3: "Blink your eyes 3 times",

        left: "Turn your face LEFT",

        right: "Turn your face RIGHT",

        up: "Look UP",

        down: "Look DOWN",

        smile: "Please SMILE"
    };


    const challengeIcons = {

        blink3:
            "https://media.giphy.com/media/3o7btPCcdNniyf0ArS/giphy.gif",

        left:
            "https://cdn-icons-png.flaticon.com/512/271/271220.png",

        right:
            "https://cdn-icons-png.flaticon.com/512/271/271228.png",

        up:
            "https://cdn-icons-png.flaticon.com/512/271/271239.png",

        down:
            "https://cdn-icons-png.flaticon.com/512/271/271210.png",

        smile:
            "https://cdn-icons-png.flaticon.com/512/2584/2584606.png"
    };


    /* =========================================================
       DATE
    ========================================================= */

    function updateDate() {

        dateText.textContent = new Date().toLocaleString(
            "en-IN",
            {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            }
        );
    }

    updateDate();

    setInterval(updateDate, 1000);


    /* =========================================================
       SPEECH
    ========================================================= */

    function speak(text, priority = false) {

        speechText.textContent = text;

        if (!("speechSynthesis" in window)) {
            return;
        }

        try {

            if (priority) {
                window.speechSynthesis.cancel();
            }

            const message =
                new SpeechSynthesisUtterance(text);

            message.lang = "en-IN";
            message.rate = 0.9;
            message.pitch = 1;

            window.speechSynthesis.speak(message);

        } catch (error) {

            console.warn("Speech error:", error);
        }
    }


    /* =========================================================
       STATUS
    ========================================================= */

    function updateStatus(text, type = "info") {

        statusText.textContent = text;

        statusText.className =
            `status-bar status-${type}`;
    }


    /* =========================================================
       STATISTICS
    ========================================================= */

    function updateStats() {

        const total =
            allPersonnel.length;

        const present =
            markedAttendance.length;

        const absent =
            Math.max(0, total - present);

        const percentage =
            total > 0
                ? (present / total) * 100
                : 0;

        totalPersonnelEl.textContent = total;

        totalPresentEl.textContent = present;

        totalAbsentEl.textContent = absent;

        progressBar.style.width =
            `${percentage}%`;

        progressPercent.textContent =
            `${Math.round(percentage)}%`;
    }


    /* =========================================================
       EYE ASPECT RATIO
    ========================================================= */

    function getEyeAspectRatio(eye) {

        if (!eye || eye.length < 6) {
            return 0.3;
        }

        const A = Math.hypot(
            eye[1].x - eye[5].x,
            eye[1].y - eye[5].y
        );

        const B = Math.hypot(
            eye[2].x - eye[4].x,
            eye[2].y - eye[4].y
        );

        const C = Math.hypot(
            eye[0].x - eye[3].x,
            eye[0].y - eye[3].y
        );

        if (C === 0) {
            return 0.3;
        }

        return (A + B) / (2 * C);
    }


    /* =========================================================
       CREATE STUDENT STATE
    ========================================================= */

    function createStudentState() {

        return {

            challenge: null,

            challengeStartedAt: 0,

            challengeVerified: false,

            blinkState: "open",

            blinkCount: 0,

            eyesClosedSince: null,

            lastBlinkTime: 0,

            otpVerified: false,

            otpInProgress: false,

            otpRecognition: null,

            otpTimeout: null,

            retryAt: 0
        };
    }


    function getStudentState(label) {

        if (!studentStates[label]) {
            studentStates[label] =
                createStudentState();
        }

        return studentStates[label];
    }


    /* =========================================================
       CREATE RANDOM CHALLENGE
    ========================================================= */

    function createChallenge(label) {

        const state =
            getStudentState(label);

        const randomIndex =
            Math.floor(
                Math.random() * challenges.length
            );

        const type =
            challenges[randomIndex];

        state.challenge = {
            type: type,
            verified: false,
            count: 0,
            startTime: Date.now()
        };

        state.challengeStartedAt =
            Date.now();

        state.challengeVerified = false;

        state.blinkState = "open";
        state.blinkCount = 0;

        state.eyesClosedSince = null;
        state.lastBlinkTime = 0;

        const instruction =
            challengeInstructions[type];

        showChallenge(type);

        speak(instruction, true);

        updateStatus(
            `Challenge: ${instruction}`,
            "info"
        );

        return state.challenge;
    }


    /* =========================================================
       SHOW CHALLENGE
    ========================================================= */

    function showChallenge(type) {

        if (!challengeInstructions[type]) {
            return;
        }

        const instruction =
            challengeInstructions[type];

        challengeTextEl.textContent =
            `Challenge: ${instruction}`;

        challengeIconEl.src =
            challengeIcons[type] ||
            "https://cdn-icons-png.flaticon.com/512/1828/1828640.png";

        challengeStatusEl.textContent =
            type === "blink3"
                ? "Blink count: 0 / 3"
                : "Perform this action";

        challengeBox.style.display =
            "block";
    }


    /* =========================================================
       UPDATE CHALLENGE UI
    ========================================================= */

    function updateChallengeUI(state) {

        if (!state.challenge) {
            return;
        }

        const type =
            state.challenge.type;

        if (type === "blink3") {

            challengeStatusEl.textContent =
                `Blink count: ${state.blinkCount} / 3`;

        } else if (state.challengeVerified) {

            challengeStatusEl.textContent =
                "Challenge verified ✓";

        } else {

            challengeStatusEl.textContent =
                "Perform this action";
        }
    }


    /* =========================================================
       FACE GEOMETRY
    ========================================================= */

    function getFaceGeometry(landmarks) {

        const jaw =
            landmarks.getJawOutline();

        const nose =
            landmarks.getNose();

        const leftEye =
            landmarks.getLeftEye();

        const rightEye =
            landmarks.getRightEye();

        const mouth =
            landmarks.getMouth();

        if (
            !jaw ||
            !nose ||
            !leftEye ||
            !rightEye ||
            !mouth
        ) {
            return null;
        }

        const noseTip =
            nose[3];

        const faceLeft =
            jaw[0];

        const faceRight =
            jaw[16];

        const faceWidth =
            Math.max(
                1,
                Math.abs(
                    faceRight.x -
                    faceLeft.x
                )
            );

        const eyeCenterX =
            (
                leftEye[0].x +
                rightEye[3].x
            ) / 2;

        const eyeCenterY =
            (
                leftEye[1].y +
                rightEye[1].y
            ) / 2;

        return {
            jaw,
            nose,
            noseTip,
            leftEye,
            rightEye,
            mouth,
            faceWidth,
            eyeCenterX,
            eyeCenterY
        };
    }


    /* =========================================================
       BLINK DETECTION
    ========================================================= */

    function detectBlink(
        state,
        ear,
        now
    ) {

        /*
           STEP 1
           Open -> Closed
        */

        if (
            state.blinkState === "open" &&
            ear <= EAR_CLOSED
        ) {

            state.blinkState = "closed";

            state.eyesClosedSince = now;

            return false;
        }


        /*
           STEP 2
           Closed -> Open

           This is when one blink
           is actually counted.
        */

        if (
            state.blinkState === "closed" &&
            ear >= EAR_OPEN
        ) {

            const closedDuration =
                state.eyesClosedSince
                    ? now -
                      state.eyesClosedSince
                    : 0;

            state.blinkState = "open";

            state.eyesClosedSince = null;


            /*
               Ignore tiny noise.
            */

            if (
                closedDuration >=
                MIN_BLINK_DURATION
            ) {

                if (
                    now -
                    state.lastBlinkTime >=
                    MIN_TIME_BETWEEN_BLINKS
                ) {

                    state.blinkCount++;

                    state.lastBlinkTime =
                        now;

                    return true;
                }
            }
        }

        return false;
    }


    /* =========================================================
       LONG EYE CLOSURE CHECK
    ========================================================= */

    function checkLongEyeClosure(
        state,
        now
    ) {

        if (
            state.blinkState === "closed" &&
            state.eyesClosedSince
        ) {

            const duration =
                now -
                state.eyesClosedSince;

            return (
                duration >
                MAX_EYES_CLOSED_TIME
            );
        }

        return false;
    }


    /* =========================================================
       POSE CHALLENGE
    ========================================================= */

    function checkPoseChallenge(
        state,
        geometry
    ) {

        const challenge =
            state.challenge;

        if (!challenge) {
            return false;
        }

        const nose =
            geometry.noseTip;

        const jaw =
            geometry.jaw;

        const faceWidth =
            geometry.faceWidth;


        /* =========================
           LEFT
        ========================= */

        if (challenge.type === "left") {

            const normalizedX =
                (
                    nose.x -
                    jaw[0].x
                ) /
                faceWidth;

            if (
                normalizedX <
                0.30
            ) {
                return true;
            }
        }


        /* =========================
           RIGHT
        ========================= */

        if (challenge.type === "right") {

            const normalizedX =
                (
                    nose.x -
                    jaw[0].x
                ) /
                faceWidth;

            if (
                normalizedX >
                0.70
            ) {
                return true;
            }
        }


        /* =========================
           UP
        ========================= */

        if (challenge.type === "up") {

            const noseDifference =
                nose.y -
                geometry.eyeCenterY;

            if (
                noseDifference <
                -faceWidth * 0.10
            ) {
                return true;
            }
        }


        /* =========================
           DOWN
        ========================= */

        if (challenge.type === "down") {

            const noseDifference =
                nose.y -
                geometry.eyeCenterY;

            if (
                noseDifference >
                faceWidth * 0.18
            ) {
                return true;
            }
        }


        /* =========================
           SMILE
        ========================= */

        if (challenge.type === "smile") {

            const mouth =
                geometry.mouth;

            const mouthWidth =
                Math.hypot(
                    mouth[0].x -
                    mouth[6].x,

                    mouth[0].y -
                    mouth[6].y
                );

            const mouthHeight =
                Math.hypot(
                    mouth[3].x -
                    mouth[9].x,

                    mouth[3].y -
                    mouth[9].y
                );

            const mouthWidthRatio =
                mouthWidth /
                faceWidth;

            const smileRatio =
                mouthWidth /
                Math.max(
                    mouthHeight,
                    1
                );


            if (
                mouthWidthRatio > 0.30 &&
                smileRatio > 2.5
            ) {

                return true;
            }
        }


        return false;
    }


    /* =========================================================
       LIVENESS CHECK
    ========================================================= */

    function checkLiveness(
        landmarks,
        label
    ) {

        const state =
            getStudentState(label);

        const now =
            Date.now();


        /*
           Already fully verified.
        */

        if (
            state.challengeVerified &&
            state.otpVerified
        ) {
            return true;
        }


        /*
           Small cooldown after failure.
        */

        if (
            state.retryAt &&
            now < state.retryAt
        ) {
            return false;
        }


        /*
           Create random challenge.
        */

        if (!state.challenge) {
            createChallenge(label);
        }


        const geometry =
            getFaceGeometry(landmarks);

        if (!geometry) {
            return false;
        }


        const leftEAR =
            getEyeAspectRatio(
                geometry.leftEye
            );

        const rightEAR =
            getEyeAspectRatio(
                geometry.rightEye
            );

        const ear =
            (
                leftEAR +
                rightEAR
            ) / 2;


        /* =====================================================
           PROXY CHECK
        ===================================================== */

        if (
            checkLongEyeClosure(
                state,
                now
            )
        ) {

            updateStatus(
                "⚠️ Proxy blocked: Eyes closed too long",
                "error"
            );

            speak(
                "Proxy attempt detected. Please use a live face.",
                true
            );

            state.challenge = null;

            state.challengeVerified = false;

            state.otpVerified = false;

            state.otpInProgress = false;

            state.blinkCount = 0;

            state.blinkState = "open";

            state.eyesClosedSince = null;

            state.retryAt =
                now + 2000;

            return false;
        }


        /* =====================================================
           RANDOM CHALLENGE DETECTION
        ===================================================== */

        if (
            state.challenge.type ===
            "blink3"
        ) {

            detectBlink(
                state,
                ear,
                now
            );

            updateChallengeUI(state);


            if (
                state.blinkCount >= 3
            ) {

                state.challenge.verified =
                    true;

                state.challengeVerified =
                    true;

                challengeStatusEl.textContent =
                    "3 blinks detected ✓";
            }
        }


        else {

            const verified =
                checkPoseChallenge(
                    state,
                    geometry
                );

            if (verified) {

                state.challenge.verified =
                    true;

                state.challengeVerified =
                    true;

                updateChallengeUI(
                    state
                );
            }
        }


        /* =====================================================
           CHALLENGE TIMEOUT
        ===================================================== */

        if (
            now -
            state.challengeStartedAt >
            CHALLENGE_TIMEOUT &&
            !state.challengeVerified
        ) {

            speak(
                "Challenge timeout. Please try again.",
                true
            );

            updateStatus(
                "Challenge failed - Try again",
                "error"
            );

            state.challenge = null;

            state.challengeVerified = false;

            state.blinkCount = 0;

            state.blinkState = "open";

            state.eyesClosedSince = null;

            state.retryAt =
                now + 1500;

            return false;
        }


        /* =====================================================
           OTP
        ===================================================== */

        if (
            state.challengeVerified &&
            !state.otpVerified
        ) {

            startOTPChallenge(label);

            return false;
        }


        return (
            state.challengeVerified &&
            state.otpVerified
        );
    }


    /* =========================================================
       SPOKEN OTP NORMALIZATION
    ========================================================= */

    const numberWords = {

        zero: "0",
        oh: "0",

        one: "1",
        two: "2",
        three: "3",
        four: "4",
        five: "5",

        six: "6",
        seven: "7",
        eight: "8",
        nine: "9"
    };


    function normalizeSpokenOTP(transcript) {

        const text =
            transcript
                .toLowerCase()
                .trim();


        /*
           Example:
           "123"
        */

        const directDigits =
            text.replace(
                /\D/g,
                ""
            );


        if (
            directDigits.length >= 3
        ) {

            return directDigits.slice(
                0,
                3
            );
        }


        /*
           Example:
           "one two three"
        */

        const words =
            text.split(
                /[\s,-]+/
            );

        let result = "";


        for (
            const word of words
        ) {

            if (
                numberWords[word]
            ) {

                result +=
                    numberWords[word];
            }
        }


        return result;
    }


    /* =========================================================
       OTP CHALLENGE
    ========================================================= */

    function startOTPChallenge(label) {

        const state =
            getStudentState(label);


        if (
            state.otpVerified ||
            state.otpInProgress
        ) {
            return;
        }


        state.otpInProgress = true;


        const otp =
            Math.floor(
                100 +
                Math.random() * 900
            );


        otpValue.textContent = otp;

        otpBox.style.display =
            "block";

        micStatus.textContent =
            "Mic: Listening...";


        speak(
            `Security Check. Speak the numbers ${otp
                .toString()
                .split("")
                .join(" ")}`,
            true
        );


        updateStatus(
            `OTP Challenge: Say ${otp}`,
            "info"
        );


        const SpeechRecognition =
            window.SpeechRecognition ||
            window.webkitSpeechRecognition;


        /*
           Browser does not support speech
           recognition.

           Preserve fallback behaviour.
        */

        if (!SpeechRecognition) {

            speak(
                "Speech recognition is not supported. OTP automatically verified."
            );

            state.otpVerified = true;

            state.otpInProgress = false;

            setTimeout(() => {

                otpBox.style.display =
                    "none";

            }, 1500);

            return;
        }


        const recognition =
            new SpeechRecognition();


        state.otpRecognition =
            recognition;


        recognition.lang =
            "en-IN";

        recognition.continuous =
            false;

        recognition.interimResults =
            false;

        recognition.maxAlternatives =
            3;


        state.otpTimeout =
            setTimeout(() => {

                if (
                    !state.otpVerified
                ) {

                    try {
                        recognition.stop();
                    } catch (e) {}

                    state.otpInProgress =
                        false;

                    otpBox.style.display =
                        "none";

                    updateStatus(
                        "OTP timeout. Please try again.",
                        "error"
                    );

                    speak(
                        "OTP timeout. Please try again.",
                        true
                    );
                }

            }, 30000);


        recognition.onresult =
            (event) => {

                clearTimeout(
                    state.otpTimeout
                );


                let verified =
                    false;


                for (
                    const result
                    of event.results
                ) {

                    for (
                        let i = 0;
                        i < result.length;
                        i++
                    ) {

                        const transcript =
                            result[i].transcript;

                        const spokenOTP =
                            normalizeSpokenOTP(
                                transcript
                            );


                        if (
                            spokenOTP ===
                            otp.toString()
                        ) {

                            verified = true;

                            break;
                        }
                    }


                    if (verified) {
                        break;
                    }
                }


                if (verified) {

                    state.otpVerified =
                        true;

                    state.otpInProgress =
                        false;

                    state.otpRecognition =
                        null;


                    micStatus.textContent =
                        "Mic: Verified ✓";


                    updateStatus(
                        "✅ LIVENESS VERIFIED",
                        "success"
                    );


                    speak(
                        "OTP Verified. You are live.",
                        true
                    );


                    setTimeout(() => {

                        otpBox.style.display =
                            "none";

                    }, 1500);

                }

                else {

                    state.otpInProgress =
                        false;

                    micStatus.textContent =
                        "Mic: Wrong OTP";


                    updateStatus(
                        "Wrong OTP. Try again.",
                        "error"
                    );


                    speak(
                        "Wrong OTP. Try again.",
                        true
                    );


                    setTimeout(() => {

                        otpBox.style.display =
                            "none";

                        startOTPChallenge(
                            label
                        );

                    }, 1500);
                }
            };


        recognition.onerror =
            (event) => {

                clearTimeout(
                    state.otpTimeout
                );


                state.otpInProgress =
                    false;

                state.otpRecognition =
                    null;


                otpBox.style.display =
                    "none";


                console.warn(
                    "Speech recognition error:",
                    event.error
                );


                micStatus.textContent =
                    "Mic: Error";


                updateStatus(
                    "Mic error. Please allow microphone.",
                    "error"
                );


                speak(
                    "Microphone error. Please allow microphone.",
                    true
                );
            };


        recognition.onend =
            () => {

                if (
                    state.otpInProgress &&
                    !state.otpVerified
                ) {

                    state.otpInProgress =
                        false;
                }
            };


        try {

            recognition.start();

        } catch (error) {

            console.warn(
                "Recognition start error:",
                error
            );

            state.otpInProgress =
                false;

            updateStatus(
                "Could not start microphone.",
                "error"
            );
        }
    }


    /* =========================================================
       LOAD STUDENT DATASET
    ========================================================= */

    async function loadPersonnelData() {

        speak(
            "Loading student database...",
            true
        );


        const options =
            new faceapi.TinyFaceDetectorOptions({
                inputSize: 320,
                scoreThreshold: 0.4
            });


        const descriptors =
            await Promise.all(

                allPersonnel.map(
                    async (person) => {

                        try {

                            const image =
                                await faceapi.fetchImage(
                                    `./dataset/${person.name}_1.jpg`
                                );


                            const detection =
                                await faceapi
                                    .detectSingleFace(
                                        image,
                                        options
                                    )
                                    .withFaceLandmarks()
                                    .withFaceDescriptor();


                            if (
                                detection
                            ) {

                                console.log(
                                    `Dataset loaded: ${person.name}`
                                );


                                return new faceapi.LabeledFaceDescriptors(
                                    person.name,
                                    [
                                        detection.descriptor
                                    ]
                                );
                            }


                            console.warn(
                                `No face found in ${person.name}_1.jpg`
                            );

                        } catch (error) {

                            console.error(
                                `Dataset error for ${person.name}:`,
                                error
                            );
                        }


                        return null;
                    }
                )
            );


        return descriptors.filter(Boolean);
    }


    /* =========================================================
       ATTENDANCE TABLE
    ========================================================= */

    function initAttendanceTable() {

        attendanceList.innerHTML = "";


        allPersonnel.forEach(
            (person) => {

                const row =
                    document.createElement("tr");


                row.id =
                    `row-${person.name}`;


                row.innerHTML = `

                    <td>${person.empId}</td>

                    <td>${person.name}</td>

                    <td>
                        <span class="absent">
                            Absent
                        </span>
                    </td>

                    <td>-</td>

                    <td>
                        <span class="pending">
                            Pending
                        </span>
                    </td>

                    <td>
                        <span class="pending">
                            -
                        </span>
                    </td>

                `;


                attendanceList.appendChild(
                    row
                );
            }
        );


        updateStats();
    }


    /* =========================================================
       UPDATE TABLE ROW
    ========================================================= */

    function updateAttendanceRow(
        label,
        isLive
    ) {

        const row =
            document.getElementById(
                `row-${label}`
            );


        if (!row) {
            return;
        }


        const state =
            getStudentState(label);


        if (isLive) {

            row.cells[4].innerHTML =
                `
                <span class="present">
                    Verified
                </span>
                `;

        } else {

            const text =
                state.challenge
                    ? challengeInstructions[
                        state.challenge.type
                    ]
                    : "Verification required";


            row.cells[4].innerHTML =
                `
                <span class="pending">
                    ${text}
                </span>
                `;
        }


        row.cells[5].innerHTML =
            state.challenge
                ? `
                    <span class="pending">
                        ${state.challenge.type}
                    </span>
                  `
                : "-";
    }


    /* =========================================================
       MARK ATTENDANCE
    ========================================================= */

    function markAttendance(label) {

        if (
            markedAttendance.includes(
                label
            )
        ) {
            return;
        }


        markedAttendance.push(
            label
        );


        const time =
            new Date().toLocaleTimeString(
                "en-IN"
            );


        const row =
            document.getElementById(
                `row-${label}`
            );


        if (row) {

            row.cells[2].innerHTML =
                `
                <span class="present">
                    Present
                </span>
                `;

            row.cells[3].textContent =
                time;

            row.cells[4].innerHTML =
                `
                <span class="present">
                    Verified
                </span>
                `;
        }


        updateStats();


        speak(
            `${label} verified. Attendance marked.`,
            true
        );


        updateStatus(
            `✅ ${label} - Attendance Marked`,
            "success"
        );
    }


    /* =========================================================
       DRAW FACE
    ========================================================= */

    function drawFace(
        detection,
        label,
        accuracy,
        live
    ) {

        const box =
            detection.detection.box;


        const state =
            getStudentState(label);


        let status = "VERIFY";


        if (live) {

            status = "LIVE ✓";

        } else if (
            state.challenge
        ) {

            status =
                state.challenge.type;
        }


        const drawBox =
            new faceapi.draw.DrawBox(
                box,
                {
                    label:
                        `${label} | ${accuracy}% | ${status}`,

                    boxColor:
                        live
                            ? "#10b981"
                            : "#f59e0b",

                    lineWidth: 3
                }
            );


        drawBox.draw(
            overlay
        );
    }


    /* =========================================================
       UNKNOWN FACE
    ========================================================= */

    function drawUnknownFace(
        detection
    ) {

        const box =
            detection.detection.box;


        new faceapi.draw.DrawBox(
            box,
            {
                label:
                    "Unknown Face",

                boxColor:
                    "#ef4444",

                lineWidth: 3
            }
        ).draw(overlay);
    }


    /* =========================================================
       DETECTION LOOP
    ========================================================= */

    async function detectionLoop() {

        try {

            if (!faceMatcher) {
                return;
            }


            if (
                video.readyState <
                HTMLMediaElement.HAVE_CURRENT_DATA
            ) {
                return;
            }


            if (isProcessing) {
                return;
            }


            isProcessing = true;


            const options =
                new faceapi.TinyFaceDetectorOptions({
                    inputSize: 224,
                    scoreThreshold: 0.5
                });


            const detections =
                await faceapi
                    .detectAllFaces(
                        video,
                        options
                    )
                    .withFaceLandmarks()
                    .withFaceDescriptors();


            const ctx =
                overlay.getContext("2d");


            ctx.clearRect(
                0,
                0,
                overlay.width,
                overlay.height
            );


            if (
                detections.length === 0
            ) {

                updateStatus(
                    "No face detected - Please face the camera",
                    "info"
                );

                return;
            }


            const resized =
                faceapi.resizeResults(
                    detections,
                    {
                        width:
                            video.videoWidth,

                        height:
                            video.videoHeight
                    }
                );


            faceapi.draw.drawDetections(
                overlay,
                resized
            );


            for (
                const detection
                of detections
            ) {

                const bestMatch =
                    faceMatcher.findBestMatch(
                        detection.descriptor
                    );


                /*
                   UNKNOWN FACE
                */

                if (
                    bestMatch.label ===
                    "unknown"
                ) {

                    drawUnknownFace(
                        detection
                    );

                    continue;
                }


                const label =
                    bestMatch.label;


                const accuracy =
                    Math.max(
                        0,
                        (
                            1 -
                            bestMatch.distance
                        ) * 100
                    ).toFixed(1);


                const state =
                    getStudentState(label);


                /*
                   Already marked attendance.

                   Do not restart challenge.
                */

                if (
                    markedAttendance.includes(
                        label
                    )
                ) {

                    state.challengeVerified =
                        true;

                    state.otpVerified =
                        true;


                    drawFace(
                        detection,
                        label,
                        accuracy,
                        true
                    );


                    updateAttendanceRow(
                        label,
                        true
                    );


                    continue;
                }


                /*
                   LIVENESS
                */

                const isLive =
                    checkLiveness(
                        detection.landmarks,
                        label
                    );


                drawFace(
                    detection,
                    label,
                    accuracy,
                    isLive
                );


                updateAttendanceRow(
                    label,
                    isLive
                );


                /*
                   MARK ATTENDANCE
                */

                if (isLive) {

                    markAttendance(
                        label
                    );
                }
            }

        } catch (error) {

            console.error(
                "Detection loop error:",
                error
            );

            updateStatus(
                "Detection error - Retrying...",
                "error"
            );

        } finally {

            isProcessing = false;

            setTimeout(
                detectionLoop,
                DETECTION_INTERVAL
            );
        }
    }


    /* =========================================================
       CAMERA
    ========================================================= */

    async function startWebcam() {

        try {

            if (
                !navigator.mediaDevices ||
                !navigator.mediaDevices.getUserMedia
            ) {

                throw new Error(
                    "Camera API unavailable"
                );
            }


            cameraStream =
                await navigator.mediaDevices.getUserMedia(
                    {
                        video: {
                            width: {
                                ideal: 640
                            },

                            height: {
                                ideal: 480
                            },

                            facingMode: "user"
                        },

                        audio: false
                    }
                );


            video.srcObject =
                cameraStream;


            await video.play();


            await new Promise(
                (resolve) => {

                    if (
                        video.videoWidth &&
                        video.videoHeight
                    ) {

                        resolve();

                    } else {

                        video.onloadedmetadata =
                            resolve;
                    }
                }
            );


            overlay.width =
                video.videoWidth;

            overlay.height =
                video.videoHeight;


            updateStatus(
                "Camera Ready - Face the camera",
                "success"
            );


            speak(
                "Camera ready. Please face the camera.",
                true
            );


            detectionLoop();

        } catch (error) {

            console.error(
                "Camera error:",
                error
            );


            updateStatus(
                "Camera Error: Please allow camera access",
                "error"
            );


            speak(
                "Camera access is required.",
                true
            );
        }
    }


    /* =========================================================
       CSV EXPORT
    ========================================================= */

    function csvEscape(value) {

        const text =
            String(value ?? "");


        return `"${text.replace(
            /"/g,
            '""'
        )}"`;
    }


    window.exportCSV =
        function () {

            const rows = [];


            rows.push([
                "Student ID",
                "Name",
                "Status",
                "Check-in Time",
                "Liveness",
                "Challenge Type"
            ]);


            allPersonnel.forEach(
                (person) => {

                    const row =
                        document.getElementById(
                            `row-${person.name}`
                        );


                    if (!row) {
                        return;
                    }


                    rows.push([
                        row.cells[0].textContent.trim(),
                        row.cells[1].textContent.trim(),
                        row.cells[2].textContent.trim(),
                        row.cells[3].textContent.trim(),
                        row.cells[4].textContent.trim(),
                        row.cells[5].textContent.trim()
                    ]);
                }
            );


            const csv =
                rows
                    .map(
                        row =>
                            row
                                .map(csvEscape)
                                .join(",")
                    )
                    .join("\n");


            const blob =
                new Blob(
                    [csv],
                    {
                        type:
                            "text/csv;charset=utf-8;"
                    }
                );


            const url =
                URL.createObjectURL(blob);


            const link =
                document.createElement("a");


            link.href = url;

            link.download =
                `CIG_Attendance_${new Date()
                    .toISOString()
                    .slice(0, 10)}.csv`;


            document.body.appendChild(
                link
            );

            link.click();

            link.remove();

            URL.revokeObjectURL(url);


            speak(
                "Attendance report exported.",
                true
            );

            updateStatus(
                "Report exported successfully",
                "success"
            );
        };


    /* =========================================================
       EMAIL REPORT
    ========================================================= */

    window.sendEmailReport =
        async function () {

            speak(
                "Sending email report to HOD.",
                true
            );


            try {

                const records =
                    allPersonnel.map(
                        (person) => {

                            const row =
                                document.getElementById(
                                    `row-${person.name}`
                                );


                            return {

                                studentId:
                                    person.empId,

                                name:
                                    person.name,

                                status:
                                    row
                                        ? row.cells[2]
                                            .textContent
                                            .trim()
                                        : "Absent",

                                time:
                                    row
                                        ? row.cells[3]
                                            .textContent
                                            .trim()
                                        : "-",

                                liveness:
                                    row
                                        ? row.cells[4]
                                            .textContent
                                            .trim()
                                        : "Pending",

                                challenge:
                                    row
                                        ? row.cells[5]
                                            .textContent
                                            .trim()
                                        : "-"
                            };
                        }
                    );


                const response =
                    await fetch(
                        "send_report.php",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify({
                                    date:
                                        new Date()
                                            .toISOString()
                                            .slice(0, 10),

                                    records
                                })
                        }
                    );


                if (!response.ok) {

                    throw new Error(
                        "Email request failed"
                    );
                }


                updateStatus(
                    "📧 Attendance report sent to HOD",
                    "success"
                );


                speak(
                    "Attendance report sent successfully.",
                    true
                );

            } catch (error) {

                console.error(
                    "Email error:",
                    error
                );


                updateStatus(
                    "Email report failed. Check send_report.php",
                    "error"
                );


                speak(
                    "Email report could not be sent.",
                    true
                );
            }
        };


    /* =========================================================
       FINALIZE SESSION
    ========================================================= */

    window.finalizeSession =
        function () {

            const total =
                allPersonnel.length;

            const present =
                markedAttendance.length;

            const absent =
                total - present;

            const percentage =
                total > 0
                    ? Math.round(
                        (present / total) * 100
                    )
                    : 0;


            const message =
                `Attendance Session Finalized\n\n` +
                `Total Students: ${total}\n` +
                `Present: ${present}\n` +
                `Absent: ${absent}\n` +
                `Attendance Rate: ${percentage}%`;


            alert(message);


            updateStatus(
                `Session Finalized | Present: ${present}/${total}`,
                "success"
            );


            speak(
                `Session finalized. ${present} students present.`,
                true
            );
        };


    /* =========================================================
       CLEANUP
    ========================================================= */

    window.addEventListener(
        "beforeunload",
        () => {

            if (cameraStream) {

                cameraStream
                    .getTracks()
                    .forEach(
                        track =>
                            track.stop()
                    );
            }


            if (
                "speechSynthesis" in window
            ) {

                window.speechSynthesis.cancel();
            }
        }
    );


    /* =========================================================
       START SYSTEM
    ========================================================= */

    async function start() {

        try {

            updateStatus(
                "Loading AI models...",
                "info"
            );


            speak(
                "Loading artificial intelligence models.",
                true
            );


            /* =========================
               FACE API MODELS
            ========================= */

            await faceapi.nets.tinyFaceDetector
                .loadFromUri("./models");


            await faceapi.nets.faceLandmark68Net
                .loadFromUri("./models");


            await faceapi.nets.faceRecognitionNet
                .loadFromUri("./models");


            console.log(
                "All Face-API models loaded successfully."
            );


            /* =========================
               DATASET
            ========================= */

            const labeledFaceDescriptors =
                await loadPersonnelData();


            if (
                labeledFaceDescriptors.length === 0
            ) {

                updateStatus(
                    "Error: Load student photos in /dataset folder",
                    "error"
                );


                speak(
                    "No student face data was found.",
                    true
                );


                return;
            }


            /* =========================
               FACE MATCHER
            ========================= */

            faceMatcher =
                new faceapi.FaceMatcher(
                    labeledFaceDescriptors,
                    FACE_MATCH_THRESHOLD
                );


            console.log(
                `FaceMatcher threshold: ${FACE_MATCH_THRESHOLD}`
            );


            /* =========================
               TABLE + CAMERA
            ========================= */

            initAttendanceTable();

            await startWebcam();


        } catch (error) {

            console.error(
                "System initialization error:",
                error
            );


            updateStatus(
                "System initialization failed. Check browser console.",
                "error"
            );


            speak(
                "System initialization failed.",
                true
            );
        }
    }


    /* =========================================================
       START
    ========================================================= */

    start();
  }
);
