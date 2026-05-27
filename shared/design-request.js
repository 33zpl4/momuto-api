    let currentStep = 1;
    const totalSteps = 3;
    function showStep(step) {
        document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
        document.getElementById(`step${step}`).classList.add('active');
        document.querySelectorAll('.progress-step').forEach((s, i) => { if(i + 1 <= step) { s.classList.add('active'); } else { s.classList.remove('active'); } });
    }
    function nextStep() { if (validateCurrentStep()) { if (currentStep < totalSteps) { currentStep++; showStep(currentStep); document.getElementById('cta-form').scrollIntoView({behavior: 'smooth', block: 'start'}); } } }
    function prevStep() { if (currentStep > 1) { currentStep--; showStep(currentStep); } }
    function validateCurrentStep() {
        const currentStepElement = document.getElementById(`step${currentStep}`);
        const requiredFields = currentStepElement.querySelectorAll('input[required], select[required]');
        for (let field of requiredFields) {
            if (!field.value.trim() && field.type !== 'checkbox') { field.focus(); field.style.borderColor = '#e2214b'; return false; }
            if (field.type === 'checkbox' && !field.checked) { field.parentElement.style.borderColor = '#e2214b'; return false; }
        }
        if (currentStep === 2) {
            const crest = document.getElementById('clubCrest');
            if (!crest || !crest.files || crest.files.length === 0) {
                const label = document.querySelector('label[for="clubCrest"]');
                if (label) label.style.outline = '2px solid #e2214b';
                const err = document.getElementById('crestError');
                if (err) err.style.display = 'block';
                crest && crest.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return false;
            }
        }
        return true;
    }
    document.addEventListener('DOMContentLoaded', function() {
        document.querySelectorAll('.next-step').forEach(btn => { btn.addEventListener('click', nextStep); });
        document.querySelectorAll('.prev-step').forEach(btn => { btn.addEventListener('click', prevStep); });
        document.getElementById('proposalForm').addEventListener('submit', function(e) { if (!validateCurrentStep()) { e.preventDefault(); return; } });
        document.querySelectorAll('input, select').forEach(input => { input.addEventListener('input', function() { this.style.borderColor = 'rgba(255,255,255,0.3)'; }); });
        document.querySelector('a[href="#cta-form"]').addEventListener('click', function(e) { e.preventDefault(); document.getElementById('cta-form').scrollIntoView({behavior: 'smooth'}); });
    });
    function previewLogo(input) {
        const preview = document.getElementById('logoPreview');
        const nameDisplay = document.getElementById('fileNameDisplay');
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            nameDisplay.textContent = input.files[0].name;
            reader.onload = function(e) { preview.innerHTML = `<img src="${e.target.result}" style="width:100%; border-radius:4px;">`; };
            reader.readAsDataURL(input.files[0]);
            const label = document.querySelector('label[for="clubCrest"]');
            if (label) label.style.outline = '';
            const err = document.getElementById('crestError');
            if (err) err.style.display = 'none';
        }
    }
    function previewDesign(input) {
        const preview = document.getElementById('designPreview');
        const nameDisplay = document.getElementById('designNameDisplay');
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            nameDisplay.textContent = input.files[0].name;
            reader.onload = function(e) { preview.innerHTML = '<img src="' + e.target.result + '" style="width:100%; border: 1px solid rgba(255,255,255,0.1);">'; };
            reader.readAsDataURL(input.files[0]);
        }
    }
    const colors = ['#FF0000','#00FF00','#0000FF','#FFFF00','#FF00FF','#00FFFF','#800000','#008000','#000080','#808000','#800080','#008080','#FFA500','#FFC0CB','#A52A2A','#808080','#000000','#FFFFFF','#E2214B','#0055FF','#FF29CC','#32CD32','#FF6347','#4169E1'];
    let currentColorTarget = '';
    function openColorModal(target) {
        currentColorTarget = target;
        const modal = document.getElementById('colorModal');
        const swatches = document.getElementById('colorSwatches');
        swatches.innerHTML = '';
        colors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color;
            if(color === '#FFFFFF') swatch.style.border = '1px solid #ccc';
            swatch.onclick = () => selectColor(color);
            swatches.appendChild(swatch);
        });
        modal.style.display = 'block';
    }
    function closeColorModal() { document.getElementById('colorModal').style.display = 'none'; }
    function selectColor(color) {
        document.getElementById(`${currentColorTarget}ColorCircle`).style.backgroundColor = color;
        document.getElementById(`${currentColorTarget}ColorValue`).value = color;
        closeColorModal();
    }