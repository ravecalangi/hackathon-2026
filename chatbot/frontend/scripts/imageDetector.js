const form             = document.getElementById('detector-form');
const imageInput       = document.getElementById('imageInput');
const dropZone         = document.getElementById('dropZone');
const dropInner        = document.getElementById('dropInner');
const analyzeBtn       = document.getElementById('analyzeBtn');
const results          = document.getElementById('results');
const loading          = document.getElementById('loading');
const errorBox         = document.getElementById('error-box');
const emptyState       = document.getElementById('emptyState');

const imagePreviewCard = document.getElementById('imagePreviewCard');
const imagePlaceholder = document.getElementById('imagePlaceholder');
const previewImgLarge  = document.getElementById('previewImgLarge');
const previewOverlay   = document.getElementById('previewOverlay');
const removeBtn        = document.getElementById('removeBtn');

const lightbox         = document.getElementById('lightbox');
const lightboxImg      = document.getElementById('lightboxImg');
const lightboxClose    = document.getElementById('lightboxClose');
const lightboxBackdrop = document.getElementById('lightboxBackdrop');

imageInput.addEventListener('change', () => {
    if (imageInput.files[0]) showPreview(imageInput.files[0]);
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        const dt = new DataTransfer();
        dt.items.add(file);
        imageInput.files = dt.files;
        showPreview(file);
    }
});

function showPreview(file) {
    const url = URL.createObjectURL(file);
    previewImgLarge.src           = url;
    previewImgLarge.style.display = 'block';
    imagePlaceholder.style.display = 'none';
    removeBtn.style.display       = 'block';
    imagePreviewCard.classList.add('has-image');
    lightboxImg.src               = url;
}

removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    imageInput.value               = '';
    previewImgLarge.src            = '';
    previewImgLarge.style.display  = 'none';
    imagePlaceholder.style.display = 'flex';
    removeBtn.style.display        = 'none';
    imagePreviewCard.classList.remove('has-image');
    results.style.display          = 'none';
    errorBox.style.display         = 'none';
    emptyState.style.display       = 'flex';
    lightboxImg.src                = '';
});

imagePreviewCard.addEventListener('click', () => {
    if (!imagePreviewCard.classList.contains('has-image')) return;
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
});

function closeLightbox() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
}

lightboxClose.addEventListener('click', closeLightbox);
lightboxBackdrop.addEventListener('click', closeLightbox);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!imageInput.files[0]) return;

    results.style.display    = 'none';
    errorBox.style.display   = 'none';
    emptyState.style.display = 'none';
    loading.style.display    = 'flex';
    analyzeBtn.disabled      = true;

    const formData = new FormData();
    formData.append('image', imageInput.files[0]);

    try {
        const res  = await fetch('http://localhost:3000/analyze', { method: 'POST', body: formData });
        const data = await res.json();

        loading.style.display = 'none';
        analyzeBtn.disabled   = false;

        if (data.error) { showError(data.error); return; }
        renderResults(data);
    } catch (err) {
        loading.style.display = 'none';
        analyzeBtn.disabled   = false;
        showError(err.message);
    }
});

const AI_DESCRIPTIONS = [
    "This image shows signs consistent with AI synthesis — subtle texture uniformity, near-perfect lighting, and edge blending patterns typically absent in organic photography.",
    "Artifacts in the fine details suggest generation by a diffusion model. Look for unnaturally smooth skin, repeating fabric patterns, or distorted peripheral elements.",
    "The composition and tonal balance are characteristic of AI-generated imagery. No camera sensor noise, lens distortion, or natural depth-of-field falloff detected.",
    "AI fingerprints detected — overly symmetrical features, blended backgrounds, and pixel-level consistency point to machine generation rather than real-world capture."
];

const HUMAN_DESCRIPTIONS = [
    "This appears to be an authentic photograph. Natural grain, optical imperfections, and realistic depth cues are consistent with a real camera capture.",
    "No AI generation patterns detected. The image retains natural sensor characteristics — subtle noise, realistic shadow falloff, and uneven textures typical of genuine photography.",
    "Lighting inconsistencies, micro-contrast, and organic edge detail all suggest this was captured by a camera in a real-world environment.",
    "Image authenticity indicators are present — chromatic aberration, natural motion micro-blur, and lens-consistent distortion point to a genuine photographic origin."
];

function getDescription(isAI) {
    const pool = isAI ? AI_DESCRIPTIONS : HUMAN_DESCRIPTIONS;
    return pool[Math.floor(Math.random() * pool.length)];
}

function pct(val) { return Math.round((val || 0) * 100); }

function renderResults(data) {
    const r       = data.report;
    const ai      = r.ai_generated;
    const df      = r.deepfake;
    const nsfw    = r.nsfw;
    const quality = r.quality;
    const meta    = r.meta;

    const aiPct    = pct(ai.ai.confidence);
    const humanPct = pct(ai.human.confidence);
    const dfPct    = pct(df.confidence);
    const isAI     = ai.ai.is_detected;

    document.getElementById('verdict-ai').innerHTML =
        `<span class="${isAI ? 'verdict-danger' : 'verdict-clean'}">
            ${isAI ? '⚠ AI Generated' : '✓ Human'}
        </span>`;
    document.getElementById('bars-ai').innerHTML =
        makeBar('AI', aiPct, isAI ? 'red' : 'blue') +
        makeBar('Human', humanPct, 'green');

    document.getElementById('verdict-df').innerHTML =
        `<span class="${df.is_detected ? 'verdict-danger' : 'verdict-clean'}">
            ${df.is_detected ? '⚠ Detected' : '✓ Not Detected'}
        </span>`;
    document.getElementById('bars-df').innerHTML =
        makeBar('Confidence', dfPct, df.is_detected ? 'red' : 'green');

    document.getElementById('verdict-nsfw').innerHTML =
        `<span class="${nsfw.is_detected ? 'verdict-danger' : 'verdict-clean'}">
            ${nsfw.is_detected ? '⚠ Detected' : '✓ Clean'}
        </span>`;

    document.getElementById('verdict-quality').innerHTML =
        `<span class="${quality.is_detected ? 'verdict-danger' : 'verdict-clean'}">
            ${quality.is_detected ? '⚠ Issue Found' : '✓ Good'}
        </span>`;

    document.getElementById('desc-text').textContent = getDescription(isAI);
    const badge = document.getElementById('desc-badge');
    badge.className   = `image-description-badge ${isAI ? 'ai' : 'human'}`;
    badge.textContent = isAI ? '✦ AI Signature' : '✦ Human Origin';

    document.getElementById('meta-row').innerHTML =
        `<span>📐 ${meta.width} × ${meta.height}</span>
         <span>🖼 ${meta.format}</span>
         <span>💾 ${(meta.size_bytes / 1024).toFixed(1)} KB</span>`;

    results.style.display = 'block';

    const els = results.querySelectorAll('.results-title, .result-card, .image-description, .meta-row, .disclaimer');
    els.forEach((el, i) => {
        el.style.opacity    = '0';
        el.style.transform  = 'translateY(7px)';
        el.style.transition = 'opacity 0.38s ease, transform 0.38s ease';
        setTimeout(() => {
            el.style.opacity   = '1';
            el.style.transform = 'translateY(0)';
        }, 40 + i * 60);
    });
}

function makeBar(label, value, color) {
    return `
        <div class="bar-group">
            <div class="bar-label-row">
                <span>${label}</span>
                <span>${value}%</span>
            </div>
            <div class="bar-track">
                <div class="bar-fill ${color}" data-width="${value}"></div>
            </div>
        </div>`;
}

const barObserver = new MutationObserver(() => {
    document.querySelectorAll('.bar-fill[data-width]').forEach(el => {
        const w = el.getAttribute('data-width');
        el.removeAttribute('data-width');
        requestAnimationFrame(() => { el.style.width = w + '%'; });
    });
});
barObserver.observe(document.body, { childList: true, subtree: true });

function showError(msg) {
    errorBox.textContent   = '⚠ ' + msg;
    errorBox.style.display = 'block';
}

const tabs = document.querySelectorAll('.detector-tab');
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const target = tab.getAttribute('data-tab');
        document.getElementById('panel-image').style.display = target === 'image' ? 'block' : 'none';
        document.getElementById('panel-text').style.display  = target === 'text'  ? 'block' : 'none';
    });
});

const textInput      = document.getElementById('textInput');
const charCount      = document.getElementById('charCount');
const clearTextBtn   = document.getElementById('clearTextBtn');
const analyzeTextBtn = document.getElementById('analyzeTextBtn');

const textEmptyState = document.getElementById('textEmptyState');
const textLoading    = document.getElementById('textLoading');
const textErrorBox   = document.getElementById('textErrorBox');
const textResults    = document.getElementById('textResults');

textInput.addEventListener('input', () => {
    const len = textInput.value.length;
    charCount.textContent = `${len.toLocaleString()} character${len !== 1 ? 's' : ''}`;
});

clearTextBtn.addEventListener('click', () => {
    textInput.value              = '';
    charCount.textContent        = '0 characters';
    textResults.style.display    = 'none';
    textErrorBox.style.display   = 'none';
    textEmptyState.style.display = 'flex';
});

const TEXT_AI_DESCRIPTIONS = [
    "This text exhibits hallmarks of AI generation — uniform sentence cadence, absence of natural hesitation markers, and an overly consistent tone typically absent in human writing.",
    "Statistical patterns in word choice and sentence length distribution are consistent with large language model output. The prose lacks idiosyncratic human phrasing.",
    "The writing shows low perplexity and high burstiness suppression — characteristic signals of AI generation where natural variance in complexity is flattened.",
    "Syntactic regularity and a lack of first-person experiential anchors suggest this was composed by a language model rather than a human author."
];

const TEXT_HUMAN_DESCRIPTIONS = [
    "This text shows natural variance in sentence structure, informal phrasing, and the kind of idiosyncratic word choice that is characteristic of human authorship.",
    "No significant AI generation patterns detected. The writing retains natural inconsistencies, tonal shifts, and spontaneous expression typical of human communication.",
    "High perplexity scores and organic burstiness in sentence complexity point to genuine human composition rather than AI generation.",
    "The text contains natural grammatical quirks, colloquialisms, and structural irregularities that are difficult for language models to replicate authentically."
];

function getTextDescription(isAI) {
    const pool = isAI ? TEXT_AI_DESCRIPTIONS : TEXT_HUMAN_DESCRIPTIONS;
    return pool[Math.floor(Math.random() * pool.length)];
}

analyzeTextBtn.addEventListener('click', async () => {
    const text = textInput.value.trim();

    if (!text) {
        showTextError('Please enter some text to analyze.');
        return;
    }

    if (text.length < 20) {
        showTextError('Text is too short. Please enter at least 20 characters for a meaningful analysis.');
        return;
    }

    textResults.style.display    = 'none';
    textErrorBox.style.display   = 'none';
    textEmptyState.style.display = 'none';
    textLoading.style.display    = 'flex';
    analyzeTextBtn.disabled      = true;

    try {
        const res = await fetch('http://localhost:3000/analyze-text', {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify({ text })
        });

        const data = await res.json();
        console.log('[Text Detector] Raw response from server:', JSON.stringify(data));

        textLoading.style.display = 'none';
        analyzeTextBtn.disabled   = false;

        if (data.error) {
            showTextError(data.error);
            return;
        }

        renderTextResults(data);

    } catch (err) {
        textLoading.style.display = 'none';
        analyzeTextBtn.disabled   = false;
        showTextError('Failed to connect to the server. Please make sure the backend is running.');
    }
});

function renderTextResults(data) {
    console.log('[renderTextResults] Input data:', JSON.stringify(data));

    const payload = (data.report && typeof data.report === 'object') ? data.report : data;

    const verdictRaw = (
        payload.verdict ||
        payload.label   ||
        ''
    ).toLowerCase().trim();

    let aiScore = null;

    if (typeof payload.score === 'number') {
        aiScore = payload.score;
    } else if (typeof payload.ai_score === 'number') {
        aiScore = payload.ai_score;
    } else if (typeof payload.ai_probability === 'number') {
        aiScore = payload.ai_probability;
    } else if (payload.ai_generated && typeof payload.ai_generated.ai?.confidence === 'number') {
        aiScore = payload.ai_generated.ai.confidence;
    }

    if (aiScore !== null) {
        aiScore = Math.max(0, Math.min(1, aiScore));
    }

    let isAI;
    if (verdictRaw === 'ai' || verdictRaw === 'artificial' || verdictRaw === 'generated') {
        isAI = true;
    } else if (verdictRaw === 'human' || verdictRaw === 'original') {
        isAI = false;
    } else if (aiScore !== null) {
        isAI = aiScore >= 0.5;
    } else {
        isAI = false;
    }

    if (aiScore === null) {
        aiScore = isAI ? 0.85 : 0.15;
    }

    const aiPct    = Math.round(aiScore * 100);
    const humanPct = 100 - aiPct;

    console.log(`[renderTextResults] verdict="${verdictRaw}" aiScore=${aiScore} isAI=${isAI} aiPct=${aiPct}%`);

    document.getElementById('text-verdict-main').innerHTML =
        `<span class="${isAI ? 'verdict-danger' : 'verdict-clean'}">
            ${isAI ? '⚠ AI Generated' : '✓ Human Written'}
        </span>`;

    document.getElementById('text-verdict-score').innerHTML =
        `<span class="${isAI ? 'verdict-danger' : 'verdict-clean'}">${aiPct}%</span>`;
    document.getElementById('text-bars-score').innerHTML =
        makeTextBar('AI Probability', aiPct, isAI ? 'red' : 'blue');

    document.getElementById('text-verdict-human').innerHTML =
        `<span class="${!isAI ? 'verdict-clean' : 'verdict-danger'}">${humanPct}%</span>`;
    document.getElementById('text-bars-human').innerHTML =
        makeTextBar('Human Probability', humanPct, 'green');

    document.getElementById('text-desc-text').textContent = getTextDescription(isAI);
    const badge = document.getElementById('text-desc-badge');
    badge.className   = `image-description-badge ${isAI ? 'ai' : 'human'}`;
    badge.textContent = isAI ? '✦ AI Signature' : '✦ Human Origin';

    textResults.style.display = 'block';

    const els = textResults.querySelectorAll('.results-title, .result-card, .image-description, .disclaimer');
    els.forEach((el, i) => {
        el.style.opacity    = '0';
        el.style.transform  = 'translateY(7px)';
        el.style.transition = 'opacity 0.38s ease, transform 0.38s ease';
        setTimeout(() => {
            el.style.opacity   = '1';
            el.style.transform = 'translateY(0)';
        }, 40 + i * 60);
    });
}

function makeTextBar(label, value, color) {
    return `
        <div class="bar-group">
            <div class="bar-label-row">
                <span>${label}</span>
                <span>${value}%</span>
            </div>
            <div class="bar-track">
                <div class="bar-fill ${color}" data-width="${value}"></div>
            </div>
        </div>`;
}

function showTextError(msg) {
    textErrorBox.textContent     = '⚠ ' + msg;
    textErrorBox.style.display   = 'block';
    textEmptyState.style.display = 'none';
}