/**
 * Seed2Serve — Soil Test Ticket Scanner & Auto-Fill Controller v2.0
 * Supports:
 * - Arkashine Innovations (SoiLENZ) thermal soil test receipts & Soil Health Cards
 * - Image Upload (JPG, PNG, WEBP), Mobile Camera Capture, and Live Desktop Webcam
 * - Tesseract.js client OCR with strict line-by-line parser (NO fallback defaults)
 * - Canvas image pre-processing: grayscale + binarization + 2× upscale
 * - Hard state reset on every new upload — no stale data ever
 * - Auto-fill into Crop Recommendation and Fertilizer Recommendation modules
 */
(function () {
  'use strict';

  // ─── SAMPLE TICKET (used ONLY by "Try Sample SoiLENZ Ticket" button) ─────────
  // NEVER used as a fallback for real scans — only loaded deliberately.
  const SAMPLE_TICKET = {
    name: 'Palm Orchids',
    mobile: '9611297893',
    crop: 'Palm Orchids',
    lat: 12.9753,
    lon: 77.5910,
    state_name: 'Karnataka',
    ph: 8.30,
    ec: 3.8806,
    oc: 0.20,
    n: 44.52,
    p: 62.78,
    k: 673.60,
    ca: 50.44,
    mg: 1.428,
    s: 24.620,
    fe: 4.251,
    mn: 2.157,
    cu: 1.714,
    zn: 4.451,
    b: 1.327,
    source: 'Arkashine Innovations (SoiLENZ)'
  };

  const STORAGE_KEY = 'seed2serve_soil_ticket';

  // ─── IMAGE PRE-PROCESSING ──────────────────────────────────────────────────────
  /**
   * Upscale (if small), grayscale, and binarize a dataUrl before OCR.
   * Thermal receipts have faint grey text — binarization sharpens contrast.
   * Returns a Promise<string> (new dataUrl of processed PNG).
   */
  function preprocessImageForOCR(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = img.width < 800 ? 2 : 1;
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imageData.data;
        const threshold = 128;
        for (let i = 0; i < d.length; i += 4) {
          const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          const bw = gray < threshold ? 0 : 255;
          d[i] = d[i + 1] = d[i + 2] = bw;
          // alpha stays d[i+3]
        }
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(dataUrl); // fallback: use original if load fails
      img.src = dataUrl;
    });
  }

  // ─── STRICT LINE-BY-LINE PARSER ───────────────────────────────────────────────
  /**
   * Parse OCR text strictly line-by-line.
   * Returns an object where every missing field is null — NEVER a default value.
   */
  function parseStrictLineByLine(rawText) {
    if (!rawText) return {};

    // Split lines; reconnect hyphen-broken words (e.g. "Hig\nh" → "High")
    const rawLines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const lines = [];
    for (let i = 0; i < rawLines.length; i++) {
      let curr = rawLines[i];
      if (curr.endsWith('-')) {
        curr = curr.slice(0, -1);
        if (i + 1 < rawLines.length && /^[a-zA-Z]+$/.test(rawLines[i + 1])) {
          curr += rawLines[i + 1];
          i++;
        }
      }
      lines.push(curr);
    }

    const data = {
      name: null, mobile: null, crop: null, lat: null, lon: null,
      ph: null, ec: null, oc: null, n: null, p: null, k: null,
      ca: null, mg: null, s: null, fe: null, mn: null, cu: null,
      zn: null, b: null
    };

    // Extract number from text AFTER the colon separator on a line
    function extractNumberFromLine(line) {
      let target = line;
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        target = line.substring(colonIdx + 1);
      } else {
        const dashIdx = line.indexOf('-');
        if (dashIdx !== -1) target = line.substring(dashIdx + 1);
      }
      // Fix spaced numbers e.g. "8 30" → "8.30"
      let s = target.replace(/(\d+)\s*[,.]\s*(\d+)/g, '$1.$2');
      s = s.replace(/\b(\d+)\s+(\d{2,4})\b/g, '$1.$2');
      const m = s.match(/([\d]+(?:\.[\d]+)?)/);
      if (m && m[1]) {
        const v = parseFloat(m[1]);
        return isNaN(v) ? null : v;
      }
      return null;
    }

    for (const line of lines) {
      // 1. Farmer Name — only match if no Crop/Mobile/Lat/Lon keyword on same line
      if (!data.name &&
          /\b(?:Farmer\s*Name|Name)\b/i.test(line) &&
          !/\b(?:Crop|Mobile|Phone|Lat|Lon|Receipt|Status|No\.?)\b/i.test(line)) {
        const m = line.match(/\b(?:Farmer\s*Name|Name)\s*[:\-]\s*([A-Za-z\s.'`-]+)$/i);
        if (m && m[1]) {
          const val = m[1].trim();
          if (val.length >= 2) data.name = val;
        }
      }

      // 2. Mobile
      if (!data.mobile && /\b(?:Mobile(?:\s*No\.?)?|Phone|Contact)\b/i.test(line)) {
        const m = line.match(/\b(?:Mobile(?:\s*No\.?)?|Phone|Contact)\s*[:\-]?\s*([0-9\s+\-]{8,15})/i);
        if (m && m[1]) {
          const digits = m[1].replace(/\D/g, '');
          if (digits.length >= 8) data.mobile = digits;
        }
      }

      // 3. Crop
      if (!data.crop && /\b(?:Crop(?:\s*Name)?|Sample)\b/i.test(line)) {
        const m = line.match(/\b(?:Crop(?:\s*Name)?|Sample)\s*[:\-]\s*([A-Za-z\s.'`-]+)$/i);
        if (m && m[1]) {
          const val = m[1].trim();
          if (val.length >= 2) data.crop = val;
        }
      }

      // 4. Lat/Lon
      if (data.lat === null && /\b(?:Lat\s*\/\s*Lon|GPS|Coordinates)\b/i.test(line)) {
        const m = line.match(/(?:Lat\s*\/\s*Lon|GPS|Coordinates)\s*[:\-]?\s*([\d.]+)\s*[\/,]\s*([\d.]+)/i);
        if (m && m[1] && m[2]) {
          data.lat = parseFloat(m[1]);
          data.lon = parseFloat(m[2]);
        }
      }

      // 5. pH (must be 0–14)
      if (data.ph === null && /\b(?:soil\s*)?pH\b/i.test(line)) {
        const idx = line.search(/\bpH\b/i);
        const val = extractNumberFromLine(idx >= 0 ? line.substring(idx + 2) : line);
        if (val !== null && val >= 0 && val <= 14) data.ph = val;
      }

      // 6. EC
      if (data.ec === null && /\bEC\b/i.test(line) && !/SEC/i.test(line)) {
        const idx = line.search(/\bEC\b/i);
        const val = extractNumberFromLine(idx >= 0 ? line.substring(idx) : line);
        if (val !== null) data.ec = val;
      }

      // 7. OC / Organic Carbon
      if (data.oc === null && /\b(?:OC|Organic\s*Carbon)\b/i.test(line)) {
        const val = extractNumberFromLine(line);
        if (val !== null) data.oc = val;
      }

      // 8. Nitrogen (N) — strict: must have colon/dash after the N identifier
      if (data.n === null && /\b(?:Nitrogen|Available\s*N|\bN\b)(?:\s*\([^)]*\))?\s*[:\-]/i.test(line)) {
        const val = extractNumberFromLine(line);
        if (val !== null) data.n = val;
      }

      // 9. Phosphorus (P)
      if (data.p === null && /\b(?:Phosphorus|Available\s*P|\bP\b|P2O5)(?:\s*\([^)]*\))?\s*[:\-]/i.test(line)) {
        const val = extractNumberFromLine(line);
        if (val !== null) data.p = val;
      }

      // 10. Potassium (K)
      if (data.k === null && /\b(?:Potassium|Available\s*K|\bK\b|K2O)(?:\s*\([^)]*\))?\s*[:\-]/i.test(line)) {
        const val = extractNumberFromLine(line);
        if (val !== null) data.k = val;
      }

      // 11. Calcium (Ca)
      if (data.ca === null && /\b(?:Calcium|\bCa\b)(?:\s*\([^)]*\))?\s*[:\-]/i.test(line)) {
        const val = extractNumberFromLine(line);
        if (val !== null) data.ca = val;
      }

      // 12. Magnesium (Mg)
      if (data.mg === null && /\b(?:Magnesium|\bMg\b)(?:\s*\([^)]*\))?\s*[:\-]/i.test(line)) {
        const val = extractNumberFromLine(line);
        if (val !== null) data.mg = val;
      }

      // 13. Sulphur (S)
      if (data.s === null && /\b(?:Sulphur|Sulfur|\bS\b)(?:\s*\([^)]*\))?\s*[:\-]/i.test(line)) {
        const val = extractNumberFromLine(line);
        if (val !== null) data.s = val;
      }

      // 14. Iron (Fe)
      if (data.fe === null && /\b(?:Iron|\bFe\b)(?:\s*\([^)]*\))?\s*[:\-]/i.test(line)) {
        const val = extractNumberFromLine(line);
        if (val !== null) data.fe = val;
      }

      // 15. Manganese (Mn)
      if (data.mn === null && /\b(?:Manganese|\bMn\b)(?:\s*\([^)]*\))?\s*[:\-]/i.test(line)) {
        const val = extractNumberFromLine(line);
        if (val !== null) data.mn = val;
      }

      // 16. Copper (Cu)
      if (data.cu === null && /\b(?:Copper|\bCu\b)(?:\s*\([^)]*\))?\s*[:\-]/i.test(line)) {
        const val = extractNumberFromLine(line);
        if (val !== null) data.cu = val;
      }

      // 17. Zinc (Zn)
      if (data.zn === null && /\b(?:Zinc|\bZn\b)(?:\s*\([^)]*\))?\s*[:\-]/i.test(line)) {
        const val = extractNumberFromLine(line);
        if (val !== null) data.zn = val;
      }

      // 18. Boron (B)
      if (data.b === null && /\b(?:Boron|\bB\b)(?:\s*\([^)]*\))?\s*[:\-]/i.test(line)) {
        const val = extractNumberFromLine(line);
        if (val !== null) data.b = val;
      }
    }

    // Source detection
    const lc = rawText.toLowerCase();
    data.source = (lc.includes('arkashine') || lc.includes('soilenz'))
      ? 'Arkashine Innovations (SoiLENZ)'
      : 'Soil Health Card';

    return data;
  }

  // ─── DOM ELEMENTS ─────────────────────────────────────────────────────────────
  const dropzone        = document.getElementById('ticketDropzone');
  const fileInput       = document.getElementById('ticketFileInput');
  const cameraInput     = document.getElementById('ticketCameraInput');
  const openWebcamBtn   = document.getElementById('openWebcamBtn');
  const sampleTicketBtn = document.getElementById('sampleTicketBtn');
  const statusBox       = document.getElementById('ticketStatus');
  const statusMsg       = document.getElementById('ticketStatusMsg');
  const progressFill    = document.getElementById('ticketProgressFill');
  const resultsCard     = document.getElementById('ticketResultsCard');
  const previewImg      = document.getElementById('ticketPreviewImg');
  const receiptTitle    = document.getElementById('ticketReceiptTitle');
  const receiptSubtitle = document.getElementById('ticketReceiptSubtitle');
  const clearBtn        = document.getElementById('ticketClearBtn');
  const autofillCropBtn = document.getElementById('autofillCropBtn');
  const autofillFertBtn = document.getElementById('autofillFertBtn');
  const copySoilDataBtn = document.getElementById('copySoilDataBtn');
  const copyBtnText     = document.getElementById('copyBtnText');
  const openCropEngineBtn = document.getElementById('openCropEngineBtn');
  const rawOcrTextEl    = document.getElementById('rawOcrText');

  // Guide Modal
  const guideOpenBtn  = document.getElementById('ticketGuideBtn');
  const guideModal    = document.getElementById('ticketGuideModal');
  const guideCloseBtn = document.getElementById('ticketGuideClose');

  // Webcam Modal
  const webcamModal      = document.getElementById('ticketCameraModal');
  const webcamVideo      = document.getElementById('ticketCameraVideo');
  const webcamCaptureBtn = document.getElementById('ticketCameraCaptureBtn');
  const webcamCloseBtn   = document.getElementById('ticketCameraCloseBtn');
  let webcamStream = null;

  // Active parsed data state
  let currentTicketData = null;

  // ─── HARD RESET ──────────────────────────────────────────────────────────────
  /**
   * Wipe ALL state the instant a new file/camera is selected.
   * Called BEFORE any async processing begins.
   */
  function resetScannerState() {
    currentTicketData = null;

    // Clear storage
    try {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {}

    // Clear clipboard silently
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText('').catch(() => {});
      }
    } catch (e) {}

    // Hide results card & reset its fields
    if (resultsCard) resultsCard.hidden = true;
    if (statusBox) statusBox.hidden = true;

    // Clear all val_* inputs
    const fieldIds = [
      'val_ph', 'val_ec', 'val_oc', 'val_n', 'val_p', 'val_k',
      'val_ca', 'val_mg', 'val_s', 'val_fe', 'val_mn', 'val_cu',
      'val_zn', 'val_b', 'val_name', 'val_crop', 'val_lat', 'val_lon'
    ];
    fieldIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    // Clear raw OCR debug
    if (rawOcrTextEl) rawOcrTextEl.textContent = '';

    // Clear preview image
    if (previewImg) previewImg.src = '';

    // Clear crop demo form autofill badges
    const form = document.getElementById('cropDemoForm');
    if (form) {
      form.querySelectorAll('.input-autofilled').forEach(el => el.classList.remove('input-autofilled'));
      form.querySelectorAll('.autofill-badge').forEach(el => el.remove());
      const banner = document.getElementById('cropAutofillBanner');
      if (banner) banner.hidden = true;
    }
  }

  // ─── INIT ─────────────────────────────────────────────────────────────────────
  function init() {
    setupEventListeners();
    restoreSavedTicket();
  }

  function setupEventListeners() {
    // Dropzone drag/drop
    if (dropzone) {
      ['dragenter', 'dragover'].forEach(evt => {
        dropzone.addEventListener(evt, e => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add('is-dragover');
        });
      });

      ['dragleave', 'drop'].forEach(evt => {
        dropzone.addEventListener(evt, e => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove('is-dragover');
        });
      });

      dropzone.addEventListener('drop', e => {
        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files.length) {
          handleFile(dt.files[0]);
        }
      });
    }

    // File inputs — reset state BEFORE processing
    if (fileInput) {
      fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files[0]) {
          handleFile(fileInput.files[0]);
        }
      });
    }

    if (cameraInput) {
      cameraInput.addEventListener('change', () => {
        if (cameraInput.files && cameraInput.files[0]) {
          handleFile(cameraInput.files[0]);
        }
      });
    }

    // Sample button — ONLY legitimate use of SAMPLE_TICKET
    if (sampleTicketBtn) {
      sampleTicketBtn.addEventListener('click', loadSampleTicket);
    }

    // Clear
    if (clearBtn) {
      clearBtn.addEventListener('click', clearScannedTicket);
    }

    // Action buttons
    if (autofillCropBtn) {
      autofillCropBtn.addEventListener('click', applyToCropRecommendation);
    }
    if (autofillFertBtn) {
      autofillFertBtn.addEventListener('click', openFertilizerRecommendation);
    }
    if (openCropEngineBtn) {
      openCropEngineBtn.addEventListener('click', openCropEngineExternal);
    }
    if (copySoilDataBtn) {
      copySoilDataBtn.addEventListener('click', () => copySoilDataToClipboard(true));
    }

    // Guide Modal
    if (guideOpenBtn && guideModal) {
      guideOpenBtn.addEventListener('click', () => { guideModal.hidden = false; });
    }
    if (guideCloseBtn && guideModal) {
      guideCloseBtn.addEventListener('click', () => { guideModal.hidden = true; });
    }
    if (guideModal) {
      guideModal.addEventListener('click', e => {
        if (e.target === guideModal) guideModal.hidden = true;
      });
    }

    // Webcam Modal
    if (openWebcamBtn && webcamModal) {
      openWebcamBtn.addEventListener('click', openWebcam);
    }
    if (webcamCloseBtn && webcamModal) {
      webcamCloseBtn.addEventListener('click', closeWebcam);
    }
    if (webcamCaptureBtn && webcamVideo) {
      webcamCaptureBtn.addEventListener('click', captureWebcamFrame);
    }

    // Re-fill form if Crop Recommendation modal opens
    window.addEventListener('seed2serve_open_crop_demo', () => {
      if (currentTicketData) fillCropDemoForm(currentTicketData);
    });
  }

  // ─── FILE HANDLER ─────────────────────────────────────────────────────────────
  function handleFile(file) {
    if (!file || !file.type.match(/^image\//)) {
      alert('Please upload a valid JPG, PNG, or WEBP image of your soil test ticket.');
      return;
    }

    // ⚡ HARD RESET before reading new file
    resetScannerState();

    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target.result;
      processImage(dataUrl);
    };
    reader.readAsDataURL(file);

    // Reset input value so the same file can be re-uploaded for a fresh scan
    if (fileInput) fileInput.value = '';
    if (cameraInput) cameraInput.value = '';
  }

  // ─── WEBCAM ───────────────────────────────────────────────────────────────────
  async function openWebcam() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Live webcam is not supported by your browser. Please use the camera file upload button instead.');
      return;
    }
    try {
      webcamModal.hidden = false;
      webcamStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      if (webcamVideo) {
        webcamVideo.srcObject = webcamStream;
        webcamVideo.play();
      }
    } catch (err) {
      console.warn('Webcam access error:', err);
      alert('Could not access your camera. Please check camera permissions or use standard photo upload.');
      closeWebcam();
    }
  }

  function closeWebcam() {
    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop());
      webcamStream = null;
    }
    if (webcamVideo) webcamVideo.srcObject = null;
    if (webcamModal) webcamModal.hidden = true;
  }

  function captureWebcamFrame() {
    if (!webcamVideo || !webcamStream) return;

    // ⚡ HARD RESET before processing webcam capture
    resetScannerState();

    const canvas = document.createElement('canvas');
    canvas.width = webcamVideo.videoWidth || 640;
    canvas.height = webcamVideo.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(webcamVideo, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    closeWebcam();
    processImage(dataUrl);
  }

  // ─── OCR PROCESSING PIPELINE ─────────────────────────────────────────────────
  async function processImage(dataUrl) {
    if (statusBox) statusBox.hidden = false;
    if (resultsCard) resultsCard.hidden = true;
    if (progressFill) progressFill.style.width = '10%';
    if (statusMsg) statusMsg.textContent = 'Pre-processing image for OCR...';

    if (previewImg) previewImg.src = dataUrl;

    try {
      // 1. Canvas pre-processing: upscale + grayscale + binarization
      if (statusMsg) statusMsg.textContent = 'Enhancing image contrast for thermal receipt...';
      if (progressFill) progressFill.style.width = '25%';
      const processedUrl = await preprocessImageForOCR(dataUrl);

      // 2. Run Tesseract OCR on the pre-processed image
      let rawText = '';
      if (window.Tesseract && typeof window.Tesseract.recognize === 'function') {
        if (statusMsg) statusMsg.textContent = 'Scanning receipt text with OCR engine...';
        if (progressFill) progressFill.style.width = '40%';

        const result = await window.Tesseract.recognize(processedUrl, 'eng', {
          logger: m => {
            if (m.status === 'recognizing text' && m.progress) {
              const pct = Math.round(m.progress * 100);
              if (progressFill) progressFill.style.width = `${40 + pct * 0.5}%`;
              if (statusMsg) statusMsg.textContent = `Extracting soil values from ticket... (${pct}%)`;
            }
          }
        });

        rawText = (result && result.data && result.data.text) ? result.data.text : '';
        console.log('[Tesseract OCR Result]:\n', rawText);
      } else {
        // Tesseract not loaded — try backend only, no SAMPLE_TICKET fallback
        if (statusMsg) statusMsg.textContent = 'Contacting Seed2Serve Ticket API...';
        if (progressFill) progressFill.style.width = '70%';

        const res = await fetch('/api/scan-ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: dataUrl })
        });
        if (res.ok) {
          const apiData = await res.json();
          if (apiData && apiData.rawText) rawText = apiData.rawText;
          else if (apiData && apiData.data) {
            // Server returned parsed data directly — display it
            if (rawOcrTextEl) rawOcrTextEl.textContent = '[Server-side OCR — raw text not available]';
            if (progressFill) progressFill.style.width = '100%';
            if (statusMsg) statusMsg.textContent = 'Values extracted via server API!';
            setTimeout(() => {
              if (statusBox) statusBox.hidden = true;
              displayExtractedData(apiData.data);
            }, 400);
            return;
          }
        }
      }

      // 3. Write raw OCR text to debug panel
      if (rawOcrTextEl) rawOcrTextEl.textContent = rawText || '[No text detected by OCR]';

      // 4. Strict line-by-line parse — NO SAMPLE_TICKET merging
      const parsed = parseStrictLineByLine(rawText);

      // 5. Check if anything useful was extracted
      const hasAnyValue = Object.keys(parsed).some(k => {
        if (['source', 'rawText'].includes(k)) return false;
        return parsed[k] !== null && parsed[k] !== undefined;
      });

      if (progressFill) progressFill.style.width = '100%';

      if (!hasAnyValue) {
        // OCR found nothing — show error, do NOT inject sample data
        if (statusMsg) statusMsg.textContent = '⚠ Could not extract values from this image.';
        setTimeout(() => {
          if (statusBox) statusBox.hidden = false;
          if (statusMsg) statusMsg.textContent = 'Could not extract values from this image. Please try a clearer photo — ensure good lighting and the ticket text is in focus.';
          if (progressFill) progressFill.style.width = '0%';
        }, 400);
        return;
      }

      if (statusMsg) statusMsg.textContent = 'Values extracted successfully!';
      setTimeout(() => {
        if (statusBox) statusBox.hidden = true;
        displayExtractedData(parsed);
      }, 400);

    } catch (err) {
      console.error('[Ticket OCR error]:', err);
      // Show error — NEVER fall back to SAMPLE_TICKET for real scans
      if (statusBox) statusBox.hidden = false;
      if (statusMsg) statusMsg.textContent = 'OCR processing failed. Please try again with a clearer image.';
      if (progressFill) progressFill.style.width = '0%';
    }
  }

  // ─── SAMPLE TICKET LOADER ─────────────────────────────────────────────────────
  // Intentionally uses SAMPLE_TICKET — this is the only legitimate use.
  function loadSampleTicket() {
    resetScannerState(); // still reset first so UI is clean
    if (statusBox) statusBox.hidden = false;
    if (progressFill) progressFill.style.width = '100%';
    if (statusMsg) statusMsg.textContent = 'Loading verified ArkaShine SoiLENZ sample receipt...';

    setTimeout(() => {
      if (statusBox) statusBox.hidden = true;
      displayExtractedData(SAMPLE_TICKET);
    }, 300);
  }

  // ─── DISPLAY EXTRACTED DATA ───────────────────────────────────────────────────
  function displayExtractedData(data) {
    currentTicketData = Object.assign({}, data);
    saveTicketToStorage(currentTicketData);

    if (resultsCard) resultsCard.hidden = false;

    if (receiptTitle) {
      receiptTitle.textContent = currentTicketData.source || 'ArkaShine SoiLENZ Thermal Receipt';
    }
    if (receiptSubtitle) {
      const parts = [];
      if (currentTicketData.name) parts.push(`Farmer: ${currentTicketData.name}`);
      if (currentTicketData.crop) parts.push(`Crop: ${currentTicketData.crop}`);
      if (currentTicketData.lat && currentTicketData.lon) parts.push(`GPS: ${currentTicketData.lat}, ${currentTicketData.lon}`);
      receiptSubtitle.textContent = parts.join(' • ') || 'Verified chemical readings';
    }

    // Populate all grid inputs
    const fieldIds = [
      'val_ph', 'val_ec', 'val_oc', 'val_n', 'val_p', 'val_k',
      'val_ca', 'val_mg', 'val_s', 'val_fe', 'val_mn', 'val_cu',
      'val_zn', 'val_b', 'val_name', 'val_crop', 'val_lat', 'val_lon'
    ];

    fieldIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const key = id.replace('val_', '');
      const val = currentTicketData[key];
      el.value = (val !== null && val !== undefined) ? val : '';

      el.oninput = () => {
        const updatedVal = el.type === 'number' ? parseFloat(el.value) : el.value;
        currentTicketData[key] = isNaN(updatedVal) ? el.value : updatedVal;
        saveTicketToStorage(currentTicketData);
        fillCropDemoForm(currentTicketData);
      };
    });

    // Auto-fill crop demo form
    fillCropDemoForm(currentTicketData);

    // Auto-copy fresh structured JSON to clipboard (only non-null values)
    copySoilDataToClipboard(false);

    // Scroll to results
    if (resultsCard) resultsCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ─── CROP DEMO FORM FILL ──────────────────────────────────────────────────────
  function fillCropDemoForm(data) {
    if (!data) return;
    const form = document.getElementById('cropDemoForm');
    if (!form) return;

    const mapping = {
      ph: data.ph, lat: data.lat, lon: data.lon,
      state_name: data.state_name || (data.lat && data.lon ? 'Karnataka' : ''),
      oc: data.oc, ec: data.ec, n: data.n, p: data.p, k: data.k,
      ca: data.ca, mg: data.mg, s: data.s, fe: data.fe,
      mn: data.mn, cu: data.cu, zn: data.zn, b: data.b
    };

    Object.entries(mapping).forEach(([name, val]) => {
      if (val === null || val === undefined) return;
      const input = form.querySelector(`[name="${name}"]`);
      if (input) {
        input.value = val;
        input.classList.add('input-autofilled');
        let badge = input.parentElement ? input.parentElement.querySelector('.autofill-badge') : null;
        if (!badge && input.parentElement) {
          badge = document.createElement('span');
          badge.className = 'autofill-badge';
          badge.innerHTML = '✓ Ticket Auto-Filled';
          input.parentElement.appendChild(badge);
        }
      }
    });

    let banner = document.getElementById('cropAutofillBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'cropAutofillBanner';
      banner.className = 'crop-autofill-banner';
      banner.innerHTML = `
        <div class="crop-autofill-banner__content">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 6 9 17l-5-5"/></svg>
          <span><strong>Auto-filled from SoiLENZ ticket!</strong> All soil parameters have been loaded. You may adjust any number before submitting.</span>
        </div>
      `;
      form.insertBefore(banner, form.firstChild);
    } else {
      banner.hidden = false;
    }
  }

  // ─── QUERY STRING BUILDER ─────────────────────────────────────────────────────
  function buildSoilQueryParams(data) {
    if (!data) return '';
    const p = new URLSearchParams();
    if (data.crop) p.set('crop', data.crop);
    p.set('state', data.state_name || 'Karnataka');
    if (data.lat !== undefined && data.lat !== null) p.set('lat', data.lat);
    if (data.lon !== undefined && data.lon !== null) p.set('lon', data.lon);
    ['ph', 'ec', 'oc', 'n', 'p', 'k', 's', 'ca', 'mg', 'zn', 'fe', 'mn', 'cu', 'b'].forEach(k => {
      if (data[k] !== undefined && data[k] !== null && data[k] !== '') {
        p.set(k, data[k]);
      }
    });
    return p.toString();
  }

  // ─── CLIPBOARD COPY ───────────────────────────────────────────────────────────
  /**
   * Copy ONLY non-null values from currentTicketData to clipboard.
   * Never includes SAMPLE_TICKET defaults or null placeholders.
   */
  function copySoilDataToClipboard(userInitiated) {
    if (!currentTicketData) return;

    // Build payload with only non-null values
    const payload = {
      source: currentTicketData.source || 'Arkashine Innovations (SoiLENZ)',
      timestamp: new Date().toISOString()
    };

    const fields = ['name', 'mobile', 'crop', 'lat', 'lon', 'state_name',
                    'ph', 'ec', 'oc', 'n', 'p', 'k', 'ca', 'mg', 's',
                    'fe', 'mn', 'cu', 'zn', 'b'];
    fields.forEach(k => {
      const v = currentTicketData[k];
      if (v !== null && v !== undefined && v !== '') {
        payload[k] = v;
      }
    });

    const textToCopy = 'SEED2SERVE_SOIL_DATA:' + JSON.stringify(payload);

    function doFeedback() {
      if (copyBtnText) {
        copyBtnText.textContent = '✓ Copied to Clipboard!';
        if (copySoilDataBtn) {
          copySoilDataBtn.style.background = '#DFF4E4';
          copySoilDataBtn.style.borderColor = '#0A5F4A';
          copySoilDataBtn.style.color = '#0A5F4A';
        }
        setTimeout(() => {
          if (copyBtnText) copyBtnText.textContent = '📋 Copy Soil Values';
          if (copySoilDataBtn) {
            copySoilDataBtn.style.background = '';
            copySoilDataBtn.style.borderColor = '#2b7a78';
            copySoilDataBtn.style.color = '#123c35';
          }
        }, 2500);
      }
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy)
        .then(() => { if (userInitiated) doFeedback(); })
        .catch(err => {
          console.warn('Clipboard write error:', err);
          fallbackCopyText(textToCopy);
          if (userInitiated) doFeedback();
        });
    } else {
      fallbackCopyText(textToCopy);
      if (userInitiated) doFeedback();
    }
  }

  function fallbackCopyText(text) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (e) {
      console.warn('Fallback copy failed:', e);
    }
  }

  // ─── ACTION BUTTONS ───────────────────────────────────────────────────────────
  function applyToCropRecommendation() {
    if (!currentTicketData) return;
    copySoilDataToClipboard(false);
    fillCropDemoForm(currentTicketData);
    const cropDemo = document.getElementById('cropDemo');
    if (cropDemo) {
      cropDemo.hidden = false;
      cropDemo.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function openCropEngineExternal() {
    if (!currentTicketData) return;
    copySoilDataToClipboard(false);
    const qs = buildSoilQueryParams(currentTicketData);
    window.open(`http://127.0.0.1:8000/recommend/?${qs}`, '_blank');
  }

  function openFertilizerRecommendation() {
    if (!currentTicketData) return;
    saveTicketToStorage(currentTicketData);
    copySoilDataToClipboard(false);
    const qs = buildSoilQueryParams(currentTicketData);
    window.open(`http://127.0.0.1:8003/soil-test-choice/?has_report=yes&${qs}`, '_blank');
  }

  // ─── PERSISTENCE ──────────────────────────────────────────────────────────────
  function saveTicketToStorage(data) {
    if (!data) return;
    try {
      const str = JSON.stringify(data);
      localStorage.setItem(STORAGE_KEY, str);
      sessionStorage.setItem(STORAGE_KEY, str);
    } catch (e) {
      console.warn('Storage save error:', e);
    }
  }

  function restoreSavedTicket() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data && (data.ph !== undefined || data.n !== undefined)) {
          displayExtractedData(data);
        }
      }
    } catch (e) {
      console.warn('Storage load error:', e);
    }
  }

  function clearScannedTicket() {
    resetScannerState();
  }

  // ─── PUBLIC API ───────────────────────────────────────────────────────────────
  window.Seed2ServeTicketScanner = {
    parse: parseStrictLineByLine,
    loadSample: loadSampleTicket,
    getData: () => currentTicketData,
    fillCropForm: fillCropDemoForm,
    reset: resetScannerState
  };

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
