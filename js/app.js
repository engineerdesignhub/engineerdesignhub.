/**
 * BeamMaster AI - Main SPA Coordinator and Application Driver
 */

// Global Application State
const appState = {
    config: {
        type: 'simply_supported',
        length: 6.0,
        supports: { a: 0.0, b: 6.0 },
        E: 200, // GPa
        I: 5000, // cm4
        loads: [
            { type: 'point', position: 3.0, magnitude: 15.0 } // default load: 15kN at center
        ],
        materialPreset: 'steel',
        sectionPreset: 'w_section'
    },
    results: null
};

// Class instances (initialized on DOM load)
let beamDiagrams = null;
let aiAssistant = null;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Firebase Auth first — app will only init once user is authenticated
    BeamAuth.init((user) => {
        if (user) {
            initializeApp();
        }
    });

    // Watch for future auth state changes (re-login after logout)
    firebase.auth().onAuthStateChanged((user) => {
        if (user && !beamDiagrams) {
            initializeApp();
        }
    });
});

/**
 * Initialize the main BeamMaster AI application (only called after auth)
 */
function initializeApp() {
    // Prevent double initialization
    if (beamDiagrams) return;

    // 1. Initialize Classes
    beamDiagrams = new BeamDiagrams('beamCanvas', 'sfdChartCanvas', 'bmdChartCanvas', 'deflectionChartCanvas');
    aiAssistant = new AIAssistant();

    // 2. Setup SPA Router Navigation
    setupRouter();

    // 3. Setup Theme Manager (Light/Dark)
    setupThemeManager();

    // 4. Setup Inputs Event Listeners
    setupInputListeners();

    // 5. Setup Project Saver
    setupProjectManager();

    // 6. Setup Exporters (PDF / Excel)
    setupExporters();

    // 7. Setup AI Chat UI
    setupAIChatUI();

    // 8. Populate Blog and Tutorials lists
    populateBlogs();
    populateTutorials();

    // 9. Initial Calculation Run
    recalculate();

    // Hook up visualizer canvas drag changes to recalculate
    beamDiagrams.onBeamConfigChange = () => {
        // Sync values from canvas drag back to inputs panel
        if (appState.config.type === 'overhanging') {
            document.getElementById('support-a-pos').value = beamDiagrams.supports.a;
            document.getElementById('support-b-pos').value = beamDiagrams.supports.b;
            appState.config.supports.a = beamDiagrams.supports.a;
            appState.config.supports.b = beamDiagrams.supports.b;
        }

        // Sync load coordinates
        appState.config.loads = beamDiagrams.loads;
        renderLoadsTable();

        // Compute new forces
        recalculate(false); // skip visual redraw to prevent drag lag
    };

    // Responsive window resizing
    window.addEventListener('resize', () => {
        if (appState.results) {
            beamDiagrams.updateBeamState(
                appState.config.type,
                appState.config.length,
                appState.config.supports,
                appState.config.loads,
                appState.results.reactions
            );
            beamDiagrams.plotDiagrams(
                appState.results.sfdData,
                appState.results.bmdData,
                appState.results.deflectionData,
                appState.results.summary
            );
        }
    });

    // Animate hero beam slightly on mouse movement
    setupHeroAnimation();
}

/**
 * Single Page Application routing shell logic
 */
function setupRouter() {
    const navLinks = document.querySelectorAll('.nav-link, .logo, #cta-nav-start');
    const sections = document.querySelectorAll('.page-section');
    const burger = document.getElementById('burger-menu');
    const menuLinks = document.getElementById('menu-links');

    const navigateTo = (targetId) => {
        sections.forEach(sec => sec.classList.remove('active'));
        const targetSec = document.getElementById(targetId);
        if (targetSec) {
            targetSec.classList.add('active');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // Update active class on nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            if (link.getAttribute('data-target') === targetId) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // Close mobile burger menu
        menuLinks.classList.remove('active');
        burger.classList.remove('active');
    };

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target') || link.id === 'nav-brand' ? 'home-section' : 'calc-section';
            navigateTo(targetId);
        });
    });

    // Home buttons routing
    document.getElementById('cta-hero-start').addEventListener('click', () => navigateTo('calc-section'));
    document.getElementById('cta-hero-tutorials').addEventListener('click', () => navigateTo('tutorials-section'));

    // Footer links routing
    document.querySelectorAll('.footer-link-view').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(link.getAttribute('data-target'));
        });
    });

    // Direct footer beam shortcuts
    document.querySelectorAll('.footer-link-direct').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const bType = link.getAttribute('data-action');
            // Switch tabs in calc sidebar
            document.querySelectorAll('.beam-type-btn').forEach(btn => {
                if (btn.getAttribute('data-type') === bType) {
                    btn.click();
                }
            });
            navigateTo('calc-section');
        });
    });

    // Mobile burger toggle
    burger.addEventListener('click', () => {
        menuLinks.classList.toggle('active');
        burger.classList.toggle('active');
    });

    // Modal listeners
    const modal = document.getElementById('content-modal');
    document.getElementById('modal-close-btn').addEventListener('click', () => {
        modal.classList.remove('active');
    });
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });

    // Footer legal pages inside modal
    document.querySelectorAll('.footer-link-modal').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.getAttribute('data-modal');
            showLegalModal(page);
        });
    });
}

/**
 * Setup dark/light mode toggles and redraw diagrams with correct color palettes
 */
function setupThemeManager() {
    const btn = document.getElementById('theme-toggle');
    const sun = document.getElementById('theme-sun-icon');
    const moon = document.getElementById('theme-moon-icon');

    btn.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const newTheme = isDark ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);

        if (newTheme === 'dark') {
            sun.style.display = 'none';
            moon.style.display = 'block';
        } else {
            sun.style.display = 'block';
            moon.style.display = 'none';
        }

        // Redraw canvas and plotters with matching colors
        if (appState.results) {
            beamDiagrams.updateBeamState(
                appState.config.type,
                appState.config.length,
                appState.config.supports,
                appState.config.loads,
                appState.results.reactions
            );
            beamDiagrams.plotDiagrams(
                appState.results.sfdData,
                appState.results.bmdData,
                appState.results.deflectionData,
                appState.results.summary
            );
        }
    });
}

/**
 * Connects input elements to recalculate the state
 */
function setupInputListeners() {
    // 1. Beam Type Toggle Buttons
    const beamBtns = document.querySelectorAll('.beam-type-btn');
    beamBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            beamBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const bType = btn.getAttribute('data-type');
            appState.config.type = bType;

            // Adjust Support inputs layout
            const supportGroup = document.getElementById('overhang-supports-group');
            if (bType === 'overhanging') {
                supportGroup.style.display = 'block';
                // Set default overhang supports if unset or invalid
                appState.config.supports.a = 1.0;
                appState.config.supports.b = appState.config.length - 1.0;
                document.getElementById('support-a-pos').value = 1.0;
                document.getElementById('support-b-pos').value = appState.config.length - 1.0;
            } else {
                supportGroup.style.display = 'none';
                appState.config.supports.a = 0;
                appState.config.supports.b = appState.config.length;
            }

            // Sync constraint limits
            syncLimits();
            recalculate();
        });
    });

    // 2. Beam Length Input
    const lenInput = document.getElementById('beam-length');
    lenInput.addEventListener('change', () => {
        let len = parseFloat(lenInput.value);
        if (isNaN(len) || len < 1) len = 1;
        if (len > 30) len = 30;
        lenInput.value = len;

        appState.config.length = len;

        // Reset supports and loads to fit inside new length
        if (appState.config.type === 'overhanging') {
            appState.config.supports.a = 0.0;
            appState.config.supports.b = len;
            document.getElementById('support-a-pos').value = 0;
            document.getElementById('support-b-pos').value = len;
        } else {
            appState.config.supports.a = 0;
            appState.config.supports.b = len;
        }

        // Adjust load coordinates that exceed length
        appState.config.loads.forEach(load => {
            if (load.type === 'point' || load.type === 'moment') {
                if (load.position > len) load.position = len;
            } else if (load.type === 'udl') {
                if (load.start > len) load.start = len - 1;
                if (load.end > len) load.end = len;
                if (load.start < 0) load.start = 0;
                if (load.start >= load.end) load.end = load.start + 0.5;
            }
        });

        syncLimits();
        recalculate();
    });

    // 3. Overhanging support inputs
    const supAInput = document.getElementById('support-a-pos');
    const supBInput = document.getElementById('support-b-pos');
    const handleSupportChange = () => {
        let sa = parseFloat(supAInput.value) || 0;
        let sb = parseFloat(supBInput.value) || appState.config.length;

        sa = Math.max(0, Math.min(appState.config.length, sa));
        sb = Math.max(0, Math.min(appState.config.length, sb));

        if (sa > sb) {
            const temp = sa;
            sa = sb;
            sb = temp;
        }

        supAInput.value = sa;
        supBInput.value = sb;
        appState.config.supports.a = sa;
        appState.config.supports.b = sb;

        recalculate();
    };
    supAInput.addEventListener('change', handleSupportChange);
    supBInput.addEventListener('change', handleSupportChange);

    // 4. Material Selector
    const materialSelect = document.getElementById('beam-material');
    const customEI = document.getElementById('custom-ei-inputs');
    const eInput = document.getElementById('custom-e-val');
    const iInput = document.getElementById('custom-i-val');

    materialSelect.addEventListener('change', () => {
        const val = materialSelect.value;
        appState.config.materialPreset = val;

        if (val === 'steel') {
            appState.config.E = 200;
        } else if (val === 'concrete') {
            appState.config.E = 25;
        } else if (val === 'timber') {
            appState.config.E = 12;
        } else {
            customEI.style.display = 'block';
            appState.config.E = parseFloat(eInput.value) || 200;
        }

        if (val !== 'custom' && document.getElementById('beam-section').value !== 'custom') {
            customEI.style.display = 'none';
        }
        recalculate();
    });

    // 5. Section Profile Selector
    const sectionSelect = document.getElementById('beam-section');
    sectionSelect.addEventListener('change', () => {
        const val = sectionSelect.value;
        appState.config.sectionPreset = val;

        if (val === 'w_section') {
            appState.config.I = 5000;
        } else if (val === 'rect_section') {
            appState.config.I = 31250;
        } else if (val === 'circ_section') {
            appState.config.I = 7854;
        } else {
            customEI.style.display = 'block';
            appState.config.I = parseFloat(iInput.value) || 5000;
        }

        if (val !== 'custom' && materialSelect.value !== 'custom') {
            customEI.style.display = 'none';
        }
        recalculate();
    });

    eInput.addEventListener('change', () => {
        appState.config.E = parseFloat(eInput.value) || 200;
        recalculate();
    });
    iInput.addEventListener('change', () => {
        appState.config.I = parseFloat(iInput.value) || 5000;
        recalculate();
    });

    // 6. Add Load inputs triggers
    const loadTypeSelect = document.getElementById('load-type');
    const loadSingleGroup = document.getElementById('load-single-pos-group');
    const loadSpanGroup = document.getElementById('load-span-pos-group');
    const magLabel = document.getElementById('load-mag-label');

    loadTypeSelect.addEventListener('change', () => {
        const type = loadTypeSelect.value;
        if (type === 'udl') {
            loadSingleGroup.style.display = 'none';
            loadSpanGroup.style.display = 'grid';
            magLabel.innerText = "Load Intensity (kN/m)";
        } else {
            loadSingleGroup.style.display = 'block';
            loadSpanGroup.style.display = 'none';
            magLabel.innerText = type === 'moment' ? "Moment (kNm)" : "Magnitude (kN)";
        }
        syncLimits();
    });

    // Add load button action
    document.getElementById('btn-add-load').addEventListener('click', () => {
        const lType = loadTypeSelect.value;
        const mag = parseFloat(document.getElementById('load-magnitude').value);
        if (isNaN(mag) || mag === 0) {
            alert("Please enter a non-zero magnitude.");
            return;
        }

        const len = appState.config.length;
        let newLoad = null;

        if (lType === 'point' || lType === 'moment') {
            let pos = parseFloat(document.getElementById('load-position').value);
            if (isNaN(pos) || pos < 0 || pos > len) {
                alert(`Position must be between 0 and ${len} meters.`);
                return;
            }
            newLoad = { type: lType, position: pos, magnitude: mag };
        } else if (lType === 'udl') {
            let start = parseFloat(document.getElementById('load-start').value);
            let end = parseFloat(document.getElementById('load-end').value);
            if (isNaN(start) || isNaN(end) || start < 0 || end > len || start >= end) {
                alert(`Span must be within 0 to ${len} meters, and start coordinate must be less than end.`);
                return;
            }
            newLoad = { type: 'udl', start, end, magnitude: mag };
        }

        if (newLoad) {
            appState.config.loads.push(newLoad);
            renderLoadsTable();
            recalculate();
        }
    });
}

/**
 * Synchronizes maximum boundaries on coordinate input controls
 */
function syncLimits() {
    const L = appState.config.length;

    // Support coordinate inputs limits
    const supA = document.getElementById('support-a-pos');
    const supB = document.getElementById('support-b-pos');
    supA.max = L;
    supB.max = L;

    // Load coordinate inputs limits
    const loadPos = document.getElementById('load-position');
    const loadStart = document.getElementById('load-start');
    const loadEnd = document.getElementById('load-end');

    loadPos.max = L;
    loadStart.max = L;
    loadEnd.max = L;
}

/**
 * Runs structural engine solvers and updates charts/text reports.
 * @param {boolean} redrawVisuals - If true, triggers canvas update (disable on drag performance checks)
 */
function recalculate(redrawVisuals = true) {
    // 1. Solve calculations
    const res = BeamCalculator.solve(appState.config);
    appState.results = res;

    // 2. Render support reactions in UI cards
    const rxText = document.getElementById('res-reactions');
    const type = appState.config.type;
    if (type === 'cantilever') {
        rxText.innerHTML = `R_A = <strong>${res.reactions.RA.toFixed(2)} kN</strong> (Up)<br>M_A = <strong>${res.reactions.MA.toFixed(2)} kNm</strong> (CCW)`;
    } else if (type === 'fixed') {
        rxText.innerHTML = `R_A = <strong>${res.reactions.RA.toFixed(2)} kN</strong> | M_A = <strong>${res.reactions.MA.toFixed(2)} kNm</strong><br>R_B = <strong>${res.reactions.RB.toFixed(2)} kN</strong> | M_B = <strong>${res.reactions.MB.toFixed(2)} kNm</strong>`;
    } else {
        rxText.innerHTML = `R_A = <strong>${res.reactions.RA.toFixed(2)} kN</strong> (at ${appState.config.supports.a}m)<br>R_B = <strong>${res.reactions.RB.toFixed(2)} kN</strong> (at ${appState.config.supports.b}m)`;
    }

    // 3. Render critical values cards
    const sum = res.summary;
    document.getElementById('res-max-sf').innerText = `${sum.absMaxSF.toFixed(2)} kN`;
    document.getElementById('res-max-sf-x').innerText = `occurs at x = ${sum.maxSF_x} m`;

    document.getElementById('res-max-bm').innerText = `${sum.absMaxBM.toFixed(2)} kNm`;
    document.getElementById('res-max-bm-x').innerText = `${sum.maxBM >= 0 ? 'Sagging' : 'Hogging'} at x = ${sum.maxBM_x} m`;

    // Max physical displacement (min/max deflection)
    const maxD = Math.max(Math.abs(sum.maxDefl), Math.abs(sum.minDefl));
    const isUpward = Math.abs(sum.maxDefl) > Math.abs(sum.minDefl);
    document.getElementById('res-max-defl').innerText = `${maxD.toFixed(2)} mm`;
    document.getElementById('res-max-defl-x').innerText = `${isUpward ? 'Upward' : 'Downward'} at x = ${sum.maxDefl_x} m`;

    // Peak tags above charts
    document.getElementById('val-sf-peak').innerText = `V_max = ${sum.absMaxSF.toFixed(1)} kN`;
    document.getElementById('val-bm-peak').innerText = `M_max = ${sum.absMaxBM.toFixed(1)} kNm`;
    document.getElementById('val-defl-peak').innerText = `δ_max = ${maxD.toFixed(2)} mm`;

    // 4. Print Step-by-Step HTML report
    const stepsDiv = document.getElementById('calculations-report-body');
    stepsDiv.innerHTML = res.stepByStep.join('<br>') + `
        <h4>3. Internal Moment & Shear Maxima</h4>
        • The peak internal shear force magnitudes is evaluated to be <strong>${sum.absMaxSF.toFixed(2)} kN</strong>.<br>
        • The peak bending moment is calculated at <strong>${sum.absMaxBM.toFixed(2)} kNm</strong>.<br>
        • Deflection analysis under local structural stiffness ($EI = ${(res.EI / 1000).toFixed(0)}$ kNm²) gives a peak deflection of <strong>${maxD.toFixed(3)} mm</strong>.
    `;

    // 5. Update interactive canvas representation (if flag is true)
    if (redrawVisuals) {
        beamDiagrams.updateBeamState(
            appState.config.type,
            appState.config.length,
            appState.config.supports,
            appState.config.loads,
            res.reactions
        );
    }

    // 6. Draw Chart.js graphs
    beamDiagrams.plotDiagrams(res.sfdData, res.bmdData, res.deflectionData, res.summary);

    // Sync active loads table listing
    renderLoadsTable();
}

/**
 * Renders active loads table list on input panel sidebar
 */
function renderLoadsTable() {
    const list = document.getElementById('active-loads-list');
    list.innerHTML = '';

    if (appState.config.loads.length === 0) {
        list.innerHTML = `<div style="text-align:center; color:var(--text-muted); font-size:0.8rem; padding:1rem 0;">No active loads. Please add load.</div>`;
        return;
    }

    appState.config.loads.forEach((load, idx) => {
        const row = document.createElement('div');
        row.className = 'load-item-row';

        let typeBadge = '';
        let detailText = '';

        if (load.type === 'point') {
            typeBadge = `<span class="load-item-type-badge badge-point">POINT</span>`;
            detailText = `<span class="load-item-vals"><strong>${load.magnitude} kN</strong> at ${load.position}m</span>`;
        } else if (load.type === 'udl') {
            typeBadge = `<span class="load-item-type-badge badge-udl">UDL</span>`;
            detailText = `<span class="load-item-vals"><strong>${load.magnitude} kN/m</strong> (${load.start}m - ${load.end}m)</span>`;
        } else if (load.type === 'moment') {
            typeBadge = `<span class="load-item-type-badge badge-moment">MOMENT</span>`;
            detailText = `<span class="load-item-vals"><strong>${Math.abs(load.magnitude)} kNm</strong> (${load.magnitude >= 0 ? 'CW' : 'CCW'}) at ${load.position}m</span>`;
        }

        row.innerHTML = `
            <div class="load-item-info">
                ${typeBadge}
                ${detailText}
            </div>
            <button type="button" class="btn-remove-load" data-idx="${idx}" title="Delete Load">&times;</button>
        `;

        // Event listener for delete click
        row.querySelector('.btn-remove-load').addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-idx'));
            appState.config.loads.splice(index, 1);
            renderLoadsTable();
            recalculate();
        });

        list.appendChild(row);
    });
}

/**
 * Project Save/Load mechanics using localStorage
 */
function setupProjectManager() {
    const nameInput = document.getElementById('project-name-input');
    const selectDropdown = document.getElementById('saved-projects-select');
    const dropdownGroup = document.getElementById('saved-projects-dropdown-group');

    const updateDropdown = () => {
        selectDropdown.innerHTML = '<option value="">Select Project...</option>';
        let count = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('beammaster_project_')) {
                const projName = key.replace('beammaster_project_', '');
                const opt = document.createElement('option');
                opt.value = key;
                opt.innerText = projName;
                selectDropdown.appendChild(opt);
                count++;
            }
        }
        dropdownGroup.style.display = count > 0 ? 'block' : 'none';
    };

    // Save project click
    document.getElementById('btn-save-project').addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (!name) {
            alert("Please enter a valid project name.");
            return;
        }
        const key = `beammaster_project_${name}`;
        localStorage.setItem(key, JSON.stringify(appState.config));
        nameInput.value = '';
        updateDropdown();
        alert("Project saved successfully!");
    });

    // Load project selection change
    selectDropdown.addEventListener('change', () => {
        const key = selectDropdown.value;
        if (!key) return;
        const configData = localStorage.getItem(key);
        if (configData) {
            try {
                const parsed = JSON.parse(configData);
                appState.config = parsed;

                // Sync settings to Form inputs
                document.getElementById('beam-length').value = parsed.length;
                document.getElementById('beam-material').value = parsed.materialPreset || 'custom';
                document.getElementById('beam-section').value = parsed.sectionPreset || 'custom';

                // Toggle active beam buttons
                document.querySelectorAll('.beam-type-btn').forEach(btn => {
                    if (btn.getAttribute('data-type') === parsed.type) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });

                if (parsed.type === 'overhanging') {
                    document.getElementById('overhang-supports-group').style.display = 'block';
                    document.getElementById('support-a-pos').value = parsed.supports.a;
                    document.getElementById('support-b-pos').value = parsed.supports.b;
                } else {
                    document.getElementById('overhang-supports-group').style.display = 'none';
                }

                // If custom presets, populate numbers
                if (parsed.materialPreset === 'custom' || parsed.sectionPreset === 'custom') {
                    document.getElementById('custom-ei-inputs').style.display = 'block';
                    document.getElementById('custom-e-val').value = parsed.E;
                    document.getElementById('custom-i-val').value = parsed.I;
                } else {
                    document.getElementById('custom-ei-inputs').style.display = 'none';
                }

                syncLimits();
                recalculate();
            } catch (err) {
                console.error("Error parsing saved project details", err);
            }
        }
    });

    // Delete project click
    document.getElementById('btn-delete-project').addEventListener('click', () => {
        const key = selectDropdown.value;
        if (!key) {
            alert("Please select a project to delete.");
            return;
        }
        localStorage.removeItem(key);
        updateDropdown();
        alert("Project deleted.");
    });

    updateDropdown();
}

/**
 * Binds exporters functions (PDF print layout and CSV spreadsheet sheet downloads)
 */
function setupExporters() {
    // 1. Export Excel CSV
    document.getElementById('btn-export-excel').addEventListener('click', () => {
        if (!appState.results) return;

        let csv = 'BEAMMASTER AI - STRUCTURAL CALCULATION SHEET\n';
        csv += `Beam Support Type,${appState.config.type}\n`;
        csv += `Beam Length (m),${appState.config.length}\n`;
        csv += `Young's Modulus E (GPa),${appState.config.E}\n`;
        csv += `Moment of Inertia I (cm4),${appState.config.I}\n\n`;

        csv += 'LOAD LISTINGS\n';
        csv += 'Type,Magnitude/Intensity,Start Pos (m),End Pos (m)\n';
        appState.config.loads.forEach(load => {
            if (load.type === 'point') {
                csv += `Point Load,${load.magnitude},${load.position},${load.position}\n`;
            } else if (load.type === 'udl') {
                csv += `UDL,${load.magnitude},${load.start},${load.end}\n`;
            } else if (load.type === 'moment') {
                csv += `Moment Load,${load.magnitude},${load.position},${load.position}\n`;
            }
        });
        csv += '\n';

        csv += 'SUPPORT REACTION FORCES\n';
        csv += `Reaction R_A (kN),${appState.results.reactions.RA.toFixed(3)}\n`;
        csv += `Reaction R_B (kN),${appState.results.reactions.RB.toFixed(3)}\n`;
        csv += `Fixed end Moment M_A (kNm),${appState.results.reactions.MA.toFixed(3)}\n`;
        csv += `Fixed end Moment M_B (kNm),${appState.results.reactions.MB.toFixed(3)}\n\n`;

        csv += 'CRITICAL SUMMARY POINTS\n';
        csv += `Max Shear Force (kN),${appState.results.summary.absMaxSF.toFixed(3)},at x = ${appState.results.summary.maxSF_x} m\n`;
        csv += `Max Bending Moment (kNm),${appState.results.summary.absMaxBM.toFixed(3)},at x = ${appState.results.summary.maxBM_x} m\n`;
        csv += `Max Deflection (mm),${Math.max(Math.abs(appState.results.summary.maxDefl), Math.abs(appState.results.summary.minDefl)).toFixed(3)},at x = ${appState.results.summary.maxDefl_x} m\n`;

        // Trigger file download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", `beammaster_analysis_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // 2. Export PDF via Printable window
    document.getElementById('btn-export-pdf').addEventListener('click', () => {
        if (!appState.results) return;

        // Render printable summary report layout in a new temporary tab
        const pWin = window.open('', '_blank');

        let loadsHtml = '';
        appState.config.loads.forEach((load, idx) => {
            loadsHtml += `
                <tr>
                    <td>#${idx + 1}</td>
                    <td>${load.type.toUpperCase()}</td>
                    <td>${load.magnitude} ${load.type === 'udl' ? 'kN/m' : (load.type === 'moment' ? 'kNm' : 'kN')}</td>
                    <td>${load.type === 'udl' ? `${load.start} m - ${load.end} m` : `${load.position} m`}</td>
                </tr>
            `;
        });

        const rx = appState.results.reactions;
        const sum = appState.results.summary;
        const maxD = Math.max(Math.abs(sum.maxDefl), Math.abs(sum.minDefl));

        const reportTemplate = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>BeamMaster AI - Structural Engineering Calculations Report</title>
                <style>
                    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; padding: 40px; line-height: 1.5; }
                    .header-box { display: flex; justify-content: space-between; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
                    .header-box h1 { margin: 0; color: #0f172a; font-size: 24px; }
                    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                    .section-title { font-size: 16px; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 5px; color: #1d4ed8; font-weight: bold; margin-top: 30px; margin-bottom: 15px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 13px; }
                    th { background-color: #f8fafc; font-weight: bold; }
                    .report-val { font-family: monospace; font-size: 14px; font-weight: bold; }
                    .calculations-steps { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 6px; font-size: 12.5px; }
                    .btn-print { margin-bottom: 20px; padding: 10px 20px; background-color: #2563eb; color: white; border: none; font-weight: bold; border-radius: 4px; cursor: pointer; }
                    @media print { .btn-print { display: none; } }
                </style>
            </head>
            <body>
                <button class="btn-print" onclick="window.print()">Print or Save as PDF</button>

                <div class="header-box">
                    <div>
                        <h1>BeamMaster AI Analysis Report</h1>
                        <span style="font-size: 12px; color: #64748b;">Report generated on: ${new Date().toLocaleDateString()}</span>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-weight: 800; color: #2563eb;">BEAMMASTER AI</span><br>
                        <span style="font-size: 11px; color: #64748b;">www.beammasterai.com</span>
                    </div>
                </div>

                <div class="meta-grid">
                    <div>
                        <strong>Beam Specifications:</strong>
                        <table style="margin-top: 8px;">
                            <tr><td>System Type</td><td>${appState.config.type.toUpperCase().replace('_', ' ')}</td></tr>
                            <tr><td>Beam Span Length</td><td>${appState.config.length} m</td></tr>
                            <tr><td>Stiffness (EI)</td><td>${(appState.results.EI / 1000).toFixed(0)} kNm²</td></tr>
                        </table>
                    </div>
                    <div>
                        <strong>Support Reactions:</strong>
                        <table style="margin-top: 8px;">
                            <tr><td>Reaction R_A</td><td>${rx.RA.toFixed(2)} kN</td></tr>
                            <tr><td>Reaction R_B</td><td>${rx.RB.toFixed(2)} kN</td></tr>
                            <tr><td>Moment reaction M_A</td><td>${rx.MA.toFixed(2)} kNm</td></tr>
                            <tr><td>Moment reaction M_B</td><td>${rx.MB.toFixed(2)} kNm</td></tr>
                        </table>
                    </div>
                </div>

                <div class="section-title">Active Applied Load Listings</div>
                <table>
                    <thead>
                        <tr><th>Index</th><th>Load Type</th><th>Force / Intensity</th><th>Coordinates</th></tr>
                    </thead>
                    <tbody>
                        ${loadsHtml || '<tr><td colspan="4" style="text-align:center;">No loads applied</td></tr>'}
                    </tbody>
                </table>

                <div class="section-title">Calculation Summary Results</div>
                <table>
                    <thead>
                        <tr><th>Structural Measurement</th><th>Maximum Value</th><th>Coordinate Location</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>Internal Shear Force (V_max)</td><td class="report-val">${sum.absMaxSF.toFixed(2)} kN</td><td>x = ${sum.maxSF_x} m</td></tr>
                        <tr><td>Bending Moment (M_max)</td><td class="report-val">${sum.absMaxBM.toFixed(2)} kNm</td><td>x = ${sum.maxBM_x} m</td></tr>
                        <tr><td>Deflection (δ_max)</td><td class="report-val">${maxD.toFixed(3)} mm</td><td>x = ${sum.maxDefl_x} m</td></tr>
                    </tbody>
                </table>

                <div class="section-title">Calculations & Equations Checklist</div>
                <div class="calculations-steps">
                    ${appState.results.stepByStep.join('<br>')}
                </div>

                <div style="margin-top: 40px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #cbd5e1; padding-top: 15px;">
                    This analysis is verified by analytical static equations matrices and beam kinematics. 
                    BeamMaster AI assumes ideal structural conditions. Design checks must be cross-verified for code compliance.
                </div>
            </body>
            </html>
        `;

        pWin.document.write(reportTemplate);
        pWin.document.close();
    });
}

/**
 * Sets up AI Chat interface drawer drawer toggling, messages submission
 */
function setupAIChatUI() {
    const toggle = document.getElementById('ai-drawer-toggle');
    const panel = document.getElementById('ai-drawer-panel');
    const closeBtn = document.getElementById('ai-drawer-close');

    const input = document.getElementById('ai-chat-input');
    const sendBtn = document.getElementById('btn-ai-send');
    const chatBody = document.getElementById('ai-chat-messages');

    // Toggle drawer open/close
    toggle.addEventListener('click', () => {
        panel.classList.toggle('active');
    });
    closeBtn.addEventListener('click', () => {
        panel.classList.remove('active');
    });

    const postMessage = (text, isUser = false) => {
        const msg = document.createElement('div');
        msg.className = `chat-msg ${isUser ? 'chat-msg-user' : 'chat-msg-ai'}`;
        msg.innerHTML = text;

        // Remove quick questions box before appending new messages
        const quickQs = chatBody.querySelector('.ai-quick-qs');
        if (quickQs) chatBody.removeChild(quickQs);

        chatBody.appendChild(msg);
        chatBody.scrollTop = chatBody.scrollHeight;
    };

    const handleSend = () => {
        const queryText = input.value.trim();
        if (!queryText) return;

        // User message
        postMessage(queryText, true);
        input.value = '';

        // Add typing dots indicator
        const typing = document.createElement('div');
        typing.className = 'chat-msg chat-msg-ai';
        typing.innerHTML = `<span style="animation: pulseGlow 1s infinite;">Thinking...</span>`;
        chatBody.appendChild(typing);
        chatBody.scrollTop = chatBody.scrollHeight;

        // Delay slightly for natural feel
        setTimeout(() => {
            chatBody.removeChild(typing);

            // Get response from helper backend
            const reply = aiAssistant.getResponse(queryText, {
                config: appState.config,
                results: appState.results
            });
            postMessage(reply, false);
        }, 600);
    };

    sendBtn.addEventListener('click', handleSend);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSend();
    });

    // Dynamic Explain active beam button
    document.getElementById('btn-ai-explain-beam').addEventListener('click', () => {
        postMessage("Explain active beam setup", true);
        const reply = aiAssistant.generateBeamAnalysis({
            config: appState.config,
            results: appState.results
        });
        postMessage(reply, false);
    });

    // Quick Q buttons click
    document.querySelectorAll('.ai-quick-qs button[data-q]').forEach(btn => {
        btn.addEventListener('click', () => {
            const q = btn.getAttribute('data-q');
            input.value = q;
            handleSend();
        });
    });
}

/**
 * Fills tutorials view grid cards
 */
function populateTutorials() {
    const list = document.getElementById('tutorials-list-container');
    list.innerHTML = '';

    TUTORIALS.forEach(tut => {
        const card = document.createElement('div');
        card.className = 'card-item';
        card.innerHTML = `
            <div class="card-img-placeholder">📐</div>
            <div class="card-content">
                <span class="card-badge">${tut.difficulty} • ${tut.topic}</span>
                <h3>${tut.title}</h3>
                <p>${tut.summary}</p>
                <div class="card-footer">
                    <button class="btn btn-secondary btn-sm btn-read-theory" data-id="${tut.id}">Read Theory</button>
                    <button class="btn btn-primary btn-sm btn-load-calc" data-id="${tut.id}">Load in Calculator</button>
                </div>
            </div>
        `;

        // Read theory modal view
        card.querySelector('.btn-read-theory').addEventListener('click', () => {
            const modal = document.getElementById('content-modal');
            const body = document.getElementById('modal-content-area');

            body.innerHTML = `
                <h2>${tut.title}</h2>
                <div style="font-size: 0.95rem; line-height: 1.6;">
                    ${tut.theory}
                </div>
                <button class="btn btn-primary" id="btn-modal-load-active" style="margin-top:1.5rem; width:100%;">Load This Example In Calculator</button>
            `;

            // Bind the load button inside the modal too
            body.querySelector('#btn-modal-load-active').addEventListener('click', () => {
                modal.classList.remove('active');
                loadPreset(tut);
            });

            modal.classList.add('active');
        });

        // Load directly
        card.querySelector('.btn-load-calc').addEventListener('click', () => {
            loadPreset(tut);
        });

        list.appendChild(card);
    });
}

/**
 * Loads a tutorial worked example config directly into calculator
 */
function loadPreset(preset) {
    // 1. Copy config values
    appState.config.type = preset.beamType;
    appState.config.length = preset.length;
    appState.config.supports = JSON.parse(JSON.stringify(preset.supports));
    appState.config.E = preset.E;
    appState.config.I = preset.I;
    appState.config.loads = JSON.parse(JSON.stringify(preset.loads));
    appState.config.materialPreset = 'custom';
    appState.config.sectionPreset = 'custom';

    // 2. Update UI values
    document.getElementById('beam-length').value = preset.length;
    document.getElementById('beam-material').value = 'custom';
    document.getElementById('beam-section').value = 'custom';

    document.getElementById('custom-ei-inputs').style.display = 'block';
    document.getElementById('custom-e-val').value = preset.E;
    document.getElementById('custom-i-val').value = preset.I;

    document.querySelectorAll('.beam-type-btn').forEach(btn => {
        if (btn.getAttribute('data-type') === preset.beamType) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    if (preset.beamType === 'overhanging') {
        document.getElementById('overhang-supports-group').style.display = 'block';
        document.getElementById('support-a-pos').value = preset.supports.a;
        document.getElementById('support-b-pos').value = preset.supports.b;
    } else {
        document.getElementById('overhang-supports-group').style.display = 'none';
    }

    // 3. Switch SPA view to Calculator
    document.querySelectorAll('.page-section').forEach(sec => sec.classList.remove('active'));
    document.getElementById('calc-section').classList.add('active');

    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('data-target') === 'calc-section') {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // 4. Run recalculate
    syncLimits();
    recalculate();

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Fills blogs view grid cards
 */
function populateBlogs() {
    const list = document.getElementById('blog-list-container');
    list.innerHTML = '';

    BLOG_POSTS.forEach(post => {
        const card = document.createElement('div');
        card.className = 'card-item';
        card.innerHTML = `
            <div class="card-img-placeholder" style="background: linear-gradient(135deg, var(--accent-light), var(--primary-light)); color:var(--accent);">📖</div>
            <div class="card-content">
                <span class="card-badge">${post.category}</span>
                <h3>${post.title}</h3>
                <p>${post.summary}</p>
                <div class="card-footer">
                    <span style="font-size:0.75rem; color:var(--text-muted);">${post.author} • ${post.date}</span>
                    <button class="btn btn-secondary btn-sm btn-read-blog" data-id="${post.id}">Read Article</button>
                </div>
            </div>
        `;

        card.querySelector('.btn-read-blog').addEventListener('click', () => {
            const modal = document.getElementById('content-modal');
            const body = document.getElementById('modal-content-area');

            body.innerHTML = `
                <span class="card-badge" style="margin-bottom: 0.5rem;">${post.category}</span>
                <h2>${post.title}</h2>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1.5rem;">
                    Published on ${post.date} by <strong>${post.author}</strong> | ${post.readTime}
                </div>
                <div class="modal-body" style="font-size: 0.95rem; line-height: 1.7;">
                    ${post.content}
                </div>
            `;

            modal.classList.add('active');
        });

        list.appendChild(card);
    });
}

/**
 * Fills modal container with standard Terms/Privacy legal contents
 */
function showLegalModal(page) {
    const modal = document.getElementById('content-modal');
    const body = document.getElementById('modal-content-area');

    if (page === 'privacy') {
        body.innerHTML = `
            <h2>Privacy Policy</h2>
            <div class="modal-body">
                <p>Last updated: May 30, 2026</p>
                <p>At BeamMaster AI, accessible from www.beammasterai.com, one of our main priorities is the privacy of our visitors. This Privacy Policy document contains types of information that is collected and recorded by BeamMaster AI and how we use it.</p>
                <h3>1. Cookies and Web Beacons</h3>
                <p>Like any other website, BeamMaster AI uses 'cookies'. These cookies are used to store information including visitors' preferences, and the pages on the website that the visitor accessed or visited. The information is used to optimize the users' experience by customizing our web page content based on visitors' browser type and/or other information.</p>
                <h3>2. Saved Configurations</h3>
                <p>BeamMaster AI saves project configurations locally inside your browser's <code>localStorage</code> database. We do not upload, share, or store your load lists, physical dimensions, or calculation details to our servers. Your engineering calculations remain 100% private on your own device.</p>
                <h3>3. Consent</h3>
                <p>By using our website, you hereby consent to our Privacy Policy and agree to its Terms and Conditions.</p>
            </div>
        `;
    } else {
        body.innerHTML = `
            <h2>Terms and Conditions of Service</h2>
            <div class="modal-body">
                <p>Last updated: May 30, 2026</p>
                <p>Welcome to BeamMaster AI!</p>
                <p>These terms and conditions outline the rules and regulations for the use of BeamMaster AI's Website, located at www.beammasterai.com.</p>
                <h3>1. Disclaimer of Warranties</h3>
                <p>BeamMaster AI is an educational simulation tool for civil engineering analysis. Bending Moment Diagrams, Shear Force Diagrams, and deflection curves calculated by this software are based on ideal 2D Euler-Bernoulli beam elements equations. Under no circumstances should this platform be used as the sole verification tool for actual construction design engineering checks. All final designs must be certified by a Registered Professional Engineer (PE).</p>
                <h3>2. Limitation of Liability</h3>
                <p>In no event shall BeamMaster AI, nor any of its developers or contributors, be held liable for structural failures, design miscalculations, academic grades, or monetary damages arising out of the use of this website.</p>
            </div>
        `;
    }

    modal.classList.add('active');
}

/**
 * Creates subtle bending effect on hero SVG graphic when mouse is hovered
 */
function setupHeroAnimation() {
    const svg = document.getElementById('hero-bending-svg');
    if (!svg) return;

    const beamPath = svg.querySelector('path');
    const arrow = document.getElementById('hero-arrow-group');

    svg.addEventListener('mousemove', (e) => {
        const rect = svg.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const relativeX = Math.max(50, Math.min(350, mouseX));

        // Shift red arrow horizontally to follow cursor
        arrow.setAttribute('transform', `translate(${relativeX}, 45)`);

        // Dynamically bend the beam based on arrow position
        // Start: 50,110; End: 350, 110; Control Point: (relativeX, 110 + deflection)
        const bendIntensity = 135; // default
        beamPath.setAttribute('d', `M 50 110 Q ${relativeX} ${bendIntensity} 350 110`);
    });

    svg.addEventListener('mouseleave', () => {
        // Snap back to symmetric center position
        arrow.setAttribute('transform', 'translate(200, 45)');
        beamPath.setAttribute('d', 'M 50 110 Q 200 135 350 110');
    });
}
