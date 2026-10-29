let currentMode = 'qr';
let videoEl = null;
let stream = null;
let scanInterval = null;

document.addEventListener("DOMContentLoaded", () => {
  // Setup logic
  const token = localStorage.getItem("kiosk_token");
  if (token) {
    document.getElementById("kiosk-setup").classList.add("hidden");
    document.getElementById("kiosk-ui").classList.remove("hidden");
    initKiosk();
  }

  document.getElementById("setup-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("setup-email").value;
    const password = document.getElementById("setup-password").value;
    
    try {
      const tokens = await apiRequest("/auth/login", { method: "POST", auth: false, body: { email, password } });
      const user = await apiRequest("/auth/me", { headers: { 'Authorization': `Bearer ${tokens.access_token}` }, auth: false });
      
      if (!['admin', 'hr'].includes(user.role)) {
        throw new Error("Must be Admin or HR to setup kiosk");
      }
      
      localStorage.setItem("kiosk_token", tokens.access_token);
      document.getElementById("kiosk-setup").classList.add("hidden");
      document.getElementById("kiosk-ui").classList.remove("hidden");
      initKiosk();
    } catch(err) {
      showAlert("setup-alert", err.message || "Authorization failed");
    }
  });
  
  document.getElementById("staff-logout").addEventListener("click", (e) => {
    e.preventDefault();
    localStorage.removeItem("kiosk_token");
    if (stream) stream.getTracks().forEach(t => t.stop());
    window.location.reload();
  });
});

function initKiosk() {
  updateClock();
  setInterval(updateClock, 1000);
  
  videoEl = document.getElementById("kiosk-video");
  startCamera();
}

function updateClock() {
  const now = new Date();
  document.getElementById('kiosk-time').textContent = now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  document.getElementById('kiosk-date').textContent = now.toLocaleDateString('en-US', {weekday:'long', year:'numeric', month:'long', day:'numeric'});
}

async function startCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    videoEl.srcObject = stream;
    
    // Wait for video to be ready
    videoEl.onloadedmetadata = () => {
      startScanning();
    };
  } catch(e) {
    document.getElementById("kiosk-msg").textContent = "Error accessing camera. Please check permissions.";
  }
}

function startScanning() {
  clearInterval(scanInterval);
  if (currentMode === 'qr') {
    startQRScanner();
  } else {
    // Face mode scanning logic (mocked)
    startFaceScanner();
  }
}

window.switchMode = function(mode) {
  currentMode = mode;
  document.querySelectorAll('.kiosk-mode-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`btn-mode-${mode}`).classList.add('active');
  
  if (mode === 'qr') {
    document.getElementById('qr-overlay').classList.remove('hidden');
    document.getElementById('kiosk-msg').textContent = "Hold your employee QR badge up to the camera";
  } else {
    document.getElementById('qr-overlay').classList.add('hidden');
    document.getElementById('kiosk-msg').textContent = "Look into the camera to check in";
    document.getElementById('emp-id-hidden').value = ""; // Clear any scanned ID
  }
  
  startScanning();
};

async function startQRScanner() {
  if ('BarcodeDetector' in window) {
    const detector = new BarcodeDetector({formats: ['qr_code']});
    scanInterval = setInterval(async () => {
      if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
        try {
          const barcodes = await detector.detect(videoEl);
          if (barcodes.length > 0) {
            const qrText = barcodes[0].rawValue;
            // Assuming QR contains just employee ID or JSON with it
            let empId = qrText;
            try { const data = JSON.parse(qrText); if(data.employee_id) empId = data.employee_id; } catch(e){}
            
            clearInterval(scanInterval);
            handleQRScan(empId);
          }
        } catch(e) {}
      }
    }, 500);
  } else {
    document.getElementById('kiosk-msg').textContent = 'QR scanning not supported in this browser. Use Face Mode.';
    setTimeout(() => switchMode('face'), 3000);
  }
}

async function handleQRScan(employeeId) {
  document.getElementById('emp-id-hidden').value = employeeId;
  switchMode('face');
  document.getElementById('kiosk-msg').textContent = `QR detected for ${employeeId}. Please look at camera...`;
  // startFaceScanner will auto-trigger now because of switchMode
}

function startFaceScanner() {
  // In a real app, this would capture a frame and send it to the backend
  // For the prompt's mockup, we will just simulate a timeout for face check
  scanInterval = setInterval(() => {
    // Mock capturing face and checking in
    const empId = document.getElementById('emp-id-hidden').value;
    clearInterval(scanInterval);
    
    // Simulate API call
    simulateCheckin(empId);
  }, 2000); // Simulate 2s face detection delay
}

async function simulateCheckin(empId) {
  // In reality, you'd POST to /attendance/checkin with a photo blob and optionally empId
  // Mocking success
  showResult(true, "Jane Doe", new Date().toLocaleTimeString());
}

function showResult(success, name, timeStr, errorMsg = "") {
  const overlay = document.getElementById("result-overlay");
  overlay.className = `kiosk-result-overlay show ${success ? '' : 'error'}`;
  
  document.getElementById("result-icon-success").classList.toggle("hidden", !success);
  document.getElementById("result-icon-error").classList.toggle("hidden", success);
  
  if (success) {
    document.getElementById("result-title").textContent = name;
    document.getElementById("result-msg").textContent = `Checked in at ${timeStr}`;
  } else {
    document.getElementById("result-title").textContent = "Error";
    document.getElementById("result-msg").textContent = errorMsg;
  }
  
  setTimeout(() => {
    overlay.classList.remove("show");
    document.getElementById("emp-id-hidden").value = "";
    switchMode('qr'); // reset to default mode
  }, 3000);
}

// Override apiRequest to use kiosk token
const originalApiRequest = window.apiRequest;
window.apiRequest = async function(path, options = {}) {
  const token = localStorage.getItem("kiosk_token");
  if (token && options.auth !== false) {
    if (!options.headers) options.headers = {};
    options.headers['Authorization'] = `Bearer ${token}`;
  }
  return originalApiRequest.call(window, path, options);
};
