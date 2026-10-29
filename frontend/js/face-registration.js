const REQUIRED_ANGLES = [
  { key: "front", label: "Look straight at the camera" },
  { key: "left", label: "Turn your head slightly left" },
  { key: "right", label: "Turn your head slightly right" },
  { key: "up", label: "Look slightly up" },
  { key: "down", label: "Look slightly down" }
];

let currentStep = 0;
let stream = null;
const capturedFrames = [];

document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();
  const user = TokenStore.getUser();
  if (user) {
    Sidebar.init('face-registration');
    setAvatarElement('topbar-avatar', user);
    NotificationCenter.init('notif-bell-btn');
  }

  document.getElementById("target-employee").value = user?.employee_id || user?.id || "";

  await startCamera();
  updateStepUI();

  document.getElementById("capture-btn").addEventListener("click", captureCurrentAngle);
  document.getElementById("submit-btn").addEventListener("click", prepareSubmission);
  document.getElementById("retry-btn").addEventListener("click", resetCapture);
});

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
    document.getElementById("camera-feed").srcObject = stream;
  } catch (err) {
    if (typeof Toast !== 'undefined') {
      Toast.show("Could not access the camera: " + err.message, "error");
    } else {
      alert("Could not access the camera: " + err.message);
    }
  }
}

function updateStepperUI(stage) {
  document.getElementById("step-1").classList.remove("active", "completed");
  document.getElementById("step-2").classList.remove("active", "completed");
  document.getElementById("step-3").classList.remove("active", "completed");

  if (stage === 1) {
    document.getElementById("step-1").classList.add("active");
  } else if (stage === 2) {
    document.getElementById("step-1").classList.add("completed");
    document.getElementById("step-2").classList.add("active");
  } else if (stage === 3) {
    document.getElementById("step-1").classList.add("completed");
    document.getElementById("step-2").classList.add("completed");
    document.getElementById("step-3").classList.add("active");
  }
}

function updateStepUI() {
  const step = REQUIRED_ANGLES[currentStep];
  const label = document.getElementById("step-label");
  const progress = document.getElementById("step-progress");
  const captureProgress = document.getElementById("capture-progress");
  const captureBtn = document.getElementById("capture-btn");
  
  if (currentStep === 0) {
    updateStepperUI(1);
    captureBtn.textContent = "Start Capture";
    captureProgress.classList.add("hidden");
    document.getElementById("retry-btn").classList.add("hidden");
  } else if (currentStep > 0 && currentStep < REQUIRED_ANGLES.length) {
    updateStepperUI(2);
    captureBtn.textContent = "Capture Next";
    captureProgress.classList.remove("hidden");
    captureProgress.textContent = `${currentStep} / ${REQUIRED_ANGLES.length} captures`;
    document.getElementById("retry-btn").classList.remove("hidden");
  }

  if (!step) {
    updateStepperUI(3);
    label.textContent = "All angles captured — ready to submit.";
    progress.textContent = "";
    captureProgress.textContent = `${REQUIRED_ANGLES.length} / ${REQUIRED_ANGLES.length} captures`;
    captureBtn.classList.add("hidden");
    document.getElementById("submit-btn").classList.remove("hidden");
    document.getElementById("retry-btn").classList.remove("hidden");
  } else {
    label.textContent = step.label;
    progress.textContent = `Step ${currentStep + 1} of ${REQUIRED_ANGLES.length}`;
    captureBtn.classList.remove("hidden");
    document.getElementById("submit-btn").classList.add("hidden");
  }
}

function captureCurrentAngle() {
  const video = document.getElementById("camera-feed");
  const canvas = document.getElementById("capture-canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  capturedFrames.push({ angle: REQUIRED_ANGLES[currentStep].key, image_base64: dataUrl });

  currentStep += 1;
  updateStepUI();
}

function resetCapture() {
  capturedFrames.length = 0;
  currentStep = 0;
  document.getElementById("result-panel").classList.add("hidden");
  updateStepUI();
}

async function prepareSubmission() {
  const employeeId = document.getElementById("target-employee").value.trim();
  if (!employeeId) {
    if (typeof Toast !== 'undefined') {
      Toast.show("Employee ID is required.", "error");
    }
    return;
  }

  const submitBtn = document.getElementById("submit-btn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Checking for duplicates…";

  try {
    // Check for duplicates first using one of the frames (front angle is best)
    const frontFrame = capturedFrames.find(f => f.angle === "front")?.image_base64 || capturedFrames[0].image_base64;
    const dupCheck = await apiRequest("/ml/face/duplicate-check", {
      method: "POST",
      body: { image_base64: frontFrame }
    });

    if (dupCheck && dupCheck.is_duplicate) {
      if (typeof Modal !== 'undefined') {
        Modal.confirm(
          "Duplicate Face Detected",
          `A similar face is already registered to ${dupCheck.matched_employee_name}. Are you sure you want to continue?`,
          submitRegistration
        );
      } else {
        if (confirm(`A similar face is already registered to ${dupCheck.matched_employee_name}. Are you sure you want to continue?`)) {
          await submitRegistration();
        }
      }
    } else {
      await submitRegistration();
    }
  } catch (err) {
    // If duplicate check endpoint doesn't exist or fails, just proceed with registration
    console.warn("Duplicate check failed, proceeding with registration", err);
    await submitRegistration();
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit registration";
    }
  }
}

async function submitRegistration() {
  const employeeId = document.getElementById("target-employee").value.trim();
  const submitBtn = document.getElementById("submit-btn");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Processing…";
  }

  try {
    const result = await apiRequest("/face/register", {
      method: "POST",
      body: { employee_id: employeeId, frames: capturedFrames },
    });
    renderResult(result);
    if (result.face_registered && typeof Toast !== 'undefined') {
      Toast.show("Face registered successfully!", "success");
    }
  } catch (err) {
    if (typeof Toast !== 'undefined') {
      Toast.show(err.message, "error");
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit registration";
    }
  }
}

function renderResult(result) {
  const panel = document.getElementById("result-panel");
  panel.classList.remove("hidden");

  if (result.face_registered) {
    panel.innerHTML = `
      <div class="section-title">Success</div>
      <p style="margin-bottom: 16px;">
        ✅ Your face has been registered successfully! You can now check in and check out using Face ID.
      </p>
      ${result.confidence_score ? `<p>Confidence score: <strong>${(result.confidence_score * 100).toFixed(1)}%</strong></p>` : ''}
      <a href="attendance.html" class="btn btn-primary" style="margin-top:16px;">Go to Attendance →</a>
    `;
    return;
  }

  const statusChip = `<span class="chip chip-danger">Not enough valid angles (${result.accepted_angles}/${result.required_angles} needed)</span>`;
  const rows = (result.frame_results || []).map((f) => `
    <tr>
      <td>${f.angle}</td>
      <td>${f.accepted ? '<span class="chip chip-success">Accepted</span>' : '<span class="chip chip-danger">Rejected</span>'}</td>
      <td>${(f.reasons || []).join("; ") || "—"}</td>
    </tr>
  `).join("");

  panel.innerHTML = `
    <div class="section-title">Registration result ${statusChip}</div>
    <table>
      <thead><tr><th>Angle</th><th>Result</th><th>Reason</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}