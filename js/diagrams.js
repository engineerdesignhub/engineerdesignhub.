/**
 * BeamMaster AI - Interactive Beam Visualizer and Chart.js Diagrams Engine
 */

class BeamDiagrams {
    constructor(canvasId, sfdId, bmdId, deflectionId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        // Chart container IDs
        this.sfdId = sfdId;
        this.bmdId = bmdId;
        this.deflectionId = deflectionId;

        // Chart instances
        this.sfdChart = null;
        this.bmdChart = null;
        this.deflectionChart = null;

        // Canvas dimensions & scale properties
        this.paddingLeft = 60;
        this.paddingRight = 60;
        this.beamY = 95;
        this.beamHeight = 12;

        // Interactive drag states
        this.loads = [];
        this.supports = { a: 0, b: 0 };
        this.beamLength = 5;
        this.beamType = 'simply_supported';
        this.reactions = null;

        this.draggedLoadIdx = null;
        this.draggedSupportType = null; // 'a' or 'b' (for overhanging support dragging)
        this.hoveredLoadIdx = null;
        this.hoveredSupportType = null;
        this.dragOffset = 0; // Offset from load position

        // Event hooks (set from main app.js)
        this.onBeamConfigChange = null;

        this.setupCanvasEvents();
    }

    /**
     * Set up mouse and touch listeners for drag-and-drop on the canvas.
     */
    setupCanvasEvents() {
        const getMousePos = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            // Accounts for CSS scaling
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: ((clientX - rect.left) / rect.width) * this.canvas.width,
                y: ((clientY - rect.top) / rect.height) * this.canvas.height
            };
        };

        const handleStart = (pos) => {
            // 1. Check support dragging (only for overhanging beam)
            if (this.beamType === 'overhanging') {
                const distA = Math.abs(pos.x - this.meterToPixel(this.supports.a));
                const distB = Math.abs(pos.x - this.meterToPixel(this.supports.b));
                
                if (distA < 15 && Math.abs(pos.y - (this.beamY + 15)) < 15) {
                    this.draggedSupportType = 'a';
                    return;
                }
                if (distB < 15 && Math.abs(pos.y - (this.beamY + 15)) < 15) {
                    this.draggedSupportType = 'b';
                    return;
                }
            }

            // 2. Check loads dragging
            for (let i = 0; i < this.loads.length; i++) {
                const load = this.loads[i];
                if (load.type === 'point') {
                    const lx = this.meterToPixel(load.position);
                    // Check if clicked near arrow top or beam intersection
                    if (Math.abs(pos.x - lx) < 15 && pos.y >= this.beamY - 45 && pos.y <= this.beamY) {
                        this.draggedLoadIdx = i;
                        this.dragOffset = this.pixelToMeter(pos.x) - load.position;
                        return;
                    }
                } else if (load.type === 'udl') {
                    const lStart = this.meterToPixel(load.start);
                    const lEnd = this.meterToPixel(load.end);
                    const lCenter = (lStart + lEnd) / 2;
                    // Check if clicked inside UDL box
                    if (pos.x >= lStart - 5 && pos.x <= lEnd + 5 && pos.y >= this.beamY - 30 && pos.y <= this.beamY) {
                        this.draggedLoadIdx = i;
                        this.dragOffset = this.pixelToMeter(pos.x) - load.start;
                        return;
                    }
                } else if (load.type === 'moment') {
                    const lx = this.meterToPixel(load.position);
                    if (Math.abs(pos.x - lx) < 20 && Math.abs(pos.y - (this.beamY - 20)) < 20) {
                        this.draggedLoadIdx = i;
                        this.dragOffset = this.pixelToMeter(pos.x) - load.position;
                        return;
                    }
                }
            }
        };

        const handleMove = (pos) => {
            let cursor = 'default';
            this.hoveredLoadIdx = null;
            this.hoveredSupportType = null;

            // 1. Check support hovers for overhanging
            if (this.beamType === 'overhanging') {
                const distA = Math.abs(pos.x - this.meterToPixel(this.supports.a));
                const distB = Math.abs(pos.x - this.meterToPixel(this.supports.b));
                
                if (distA < 15 && Math.abs(pos.y - (this.beamY + 15)) < 15) {
                    cursor = 'ew-resize';
                    this.hoveredSupportType = 'a';
                } else if (distB < 15 && Math.abs(pos.y - (this.beamY + 15)) < 15) {
                    cursor = 'ew-resize';
                    this.hoveredSupportType = 'b';
                }
            }

            // 2. Check load hovers
            if (!this.hoveredSupportType) {
                for (let i = 0; i < this.loads.length; i++) {
                    const load = this.loads[i];
                    if (load.type === 'point') {
                        const lx = this.meterToPixel(load.position);
                        if (Math.abs(pos.x - lx) < 15 && pos.y >= this.beamY - 45 && pos.y <= this.beamY) {
                            cursor = 'ew-resize';
                            this.hoveredLoadIdx = i;
                            break;
                        }
                    } else if (load.type === 'udl') {
                        const lStart = this.meterToPixel(load.start);
                        const lEnd = this.meterToPixel(load.end);
                        if (pos.x >= lStart && pos.x <= lEnd && pos.y >= this.beamY - 30 && pos.y <= this.beamY) {
                            cursor = 'grab';
                            this.hoveredLoadIdx = i;
                            break;
                        }
                    } else if (load.type === 'moment') {
                        const lx = this.meterToPixel(load.position);
                        if (Math.abs(pos.x - lx) < 20 && Math.abs(pos.y - (this.beamY - 20)) < 20) {
                            cursor = 'ew-resize';
                            this.hoveredLoadIdx = i;
                            break;
                        }
                    }
                }
            }

            // 3. Perform Dragging
            if (this.draggedSupportType) {
                cursor = 'ew-resize';
                let targetPos = this.pixelToMeter(pos.x);
                targetPos = Math.max(0, Math.min(this.beamLength, targetPos));
                // Round to 1 decimal place for easy increments
                targetPos = Math.round(targetPos * 10) / 10;

                if (this.draggedSupportType === 'a') {
                    // Stay to the left of B
                    if (targetPos < this.supports.b - 0.2) {
                        this.supports.a = targetPos;
                    }
                } else {
                    // Stay to the right of A
                    if (targetPos > this.supports.a + 0.2) {
                        this.supports.b = targetPos;
                    }
                }
                
                if (this.onBeamConfigChange) this.onBeamConfigChange();
                this.draw();
            } else if (this.draggedLoadIdx !== null) {
                cursor = 'grabbing';
                const load = this.loads[this.draggedLoadIdx];
                let targetPos = this.pixelToMeter(pos.x) - this.dragOffset;
                targetPos = Math.max(0, Math.min(this.beamLength, targetPos));
                targetPos = Math.round(targetPos * 10) / 10;

                if (load.type === 'point' || load.type === 'moment') {
                    load.position = targetPos;
                } else if (load.type === 'udl') {
                    const span = load.end - load.start;
                    let newStart = targetPos;
                    let newEnd = newStart + span;
                    if (newEnd > this.beamLength) {
                        newEnd = this.beamLength;
                        newStart = newEnd - span;
                    }
                    newStart = Math.max(0, newStart);
                    load.start = Math.round(newStart * 10) / 10;
                    load.end = Math.round(newEnd * 10) / 10;
                }

                if (this.onBeamConfigChange) this.onBeamConfigChange();
                this.draw();
            }

            this.canvas.style.cursor = cursor;
        };

        const handleEnd = () => {
            this.draggedLoadIdx = null;
            this.draggedSupportType = null;
            this.canvas.style.cursor = 'default';
        };

        // Mouse Listeners
        this.canvas.addEventListener('mousedown', (e) => handleStart(getMousePos(e)));
        this.canvas.addEventListener('mousemove', (e) => handleMove(getMousePos(e)));
        window.addEventListener('mouseup', handleEnd);

        // Touch Listeners (Mobile Friendly)
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handleStart(getMousePos(e));
        }, { passive: false });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            handleMove(getMousePos(e));
        }, { passive: false });
        window.addEventListener('touchend', handleEnd);
    }

    // Helper conversions
    meterToPixel(m) {
        const spanPixels = this.canvas.width - this.paddingLeft - this.paddingRight;
        return this.paddingLeft + (m / this.beamLength) * spanPixels;
    }

    pixelToMeter(px) {
        const spanPixels = this.canvas.width - this.paddingLeft - this.paddingRight;
        return ((px - this.paddingLeft) / spanPixels) * this.beamLength;
    }

    /**
     * Sets live beam specifications for visualization.
     */
    updateBeamState(type, length, supports, loads, reactions) {
        this.beamType = type;
        this.beamLength = length;
        this.supports = supports;
        this.loads = loads;
        this.reactions = reactions;

        // Auto-fix layout sizing on first load or resize
        const rect = this.canvas.parentNode.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio || 600;
        this.canvas.height = 180;
        this.ctx.scale(1, 1);

        this.draw();
    }

    /**
     * Draws the physical beam structure, supports, reactions, and loads on canvas.
     */
    draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, w, h);

        // Grid Lines (Engineers layout)
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        ctx.strokeStyle = isDark ? '#1f2937' : '#f1f5f9';
        ctx.lineWidth = 1;
        for (let i = 0; i < w; i += 30) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
        }
        for (let i = 0; i < h; i += 30) {
            ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke();
        }

        // Draw Span Ruler / Dimension line at bottom
        ctx.strokeStyle = isDark ? '#6b7280' : '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.fillStyle = isDark ? '#f9fafb' : '#1e293b';
        ctx.font = '500 11px Inter, sans-serif';
        ctx.textAlign = 'center';

        const rulerY = this.beamY + 50;
        const p0 = this.meterToPixel(0);
        const pL = this.meterToPixel(this.beamLength);

        ctx.beginPath();
        ctx.moveTo(p0, rulerY);
        ctx.lineTo(pL, rulerY);
        ctx.stroke();

        // Left ruler tick
        ctx.beginPath(); ctx.moveTo(p0, rulerY - 5); ctx.lineTo(p0, rulerY + 5); ctx.stroke();
        // Right ruler tick
        ctx.beginPath(); ctx.moveTo(pL, rulerY - 5); ctx.lineTo(pL, rulerY + 5); ctx.stroke();
        // Text
        ctx.fillText(`L = ${this.beamLength} m`, (p0 + pL) / 2, rulerY - 7);

        // Draw Beam Core Structure
        const gradient = ctx.createLinearGradient(p0, this.beamY, pL, this.beamY);
        if (isDark) {
            gradient.addColorStop(0, '#3b82f6');
            gradient.addColorStop(1, '#1d4ed8');
        } else {
            gradient.addColorStop(0, '#2563eb');
            gradient.addColorStop(1, '#1d4ed8');
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(p0, this.beamY, pL - p0, this.beamHeight, 3);
        ctx.fill();

        // Draw Support Representations
        this.drawSupports(isDark);

        // Draw Support Reaction Forces (Upward green arrows with tags)
        if (this.reactions) {
            this.drawReactionForces(isDark);
        }

        // Draw Active Loads (Point loads, UDLs, moments)
        this.drawLoads(isDark);
    }

    drawSupports(isDark) {
        const ctx = this.ctx;
        const p0 = this.meterToPixel(0);
        const pL = this.meterToPixel(this.beamLength);
        
        ctx.fillStyle = isDark ? '#4b5563' : '#64748b';
        ctx.strokeStyle = isDark ? '#9ca3af' : '#475569';
        ctx.lineWidth = 2;

        const drawTriangleSupport = (px, isPin) => {
            const sY = this.beamY + this.beamHeight;
            ctx.beginPath();
            ctx.moveTo(px, sY);
            ctx.lineTo(px - 12, sY + 16);
            ctx.lineTo(px + 12, sY + 16);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Pinned base hatching vs Roller wheels
            if (isPin) {
                ctx.beginPath();
                ctx.moveTo(px - 16, sY + 17);
                ctx.lineTo(px + 16, sY + 17);
                ctx.stroke();
            } else {
                // Roller base line + circles
                ctx.beginPath();
                ctx.arc(px - 6, sY + 20, 2.5, 0, Math.PI * 2);
                ctx.arc(px + 6, sY + 20, 2.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(px - 16, sY + 23);
                ctx.lineTo(px + 16, sY + 23);
                ctx.stroke();
            }
        };

        const drawFixedSupport = (px, isLeft) => {
            const sY = this.beamY - 12;
            const h = this.beamHeight + 24;
            
            // Draw support wall
            ctx.fillStyle = isDark ? '#374151' : '#cbd5e1';
            ctx.fillRect(px - (isLeft ? 6 : 0), sY, 6, h);
            
            ctx.strokeStyle = isDark ? '#4b5563' : '#94a3b8';
            ctx.lineWidth = 1.5;
            // Hatchings
            for (let offset = 0; offset < h; offset += 6) {
                ctx.beginPath();
                if (isLeft) {
                    ctx.moveTo(px - 6, sY + offset);
                    ctx.lineTo(px, sY + offset - 4);
                } else {
                    ctx.moveTo(px, sY + offset);
                    ctx.lineTo(px + 6, sY + offset - 4);
                }
                ctx.stroke();
            }
        };

        if (this.beamType === 'simply_supported') {
            drawTriangleSupport(p0, true);   // Left Pinned Support A
            drawTriangleSupport(pL, false);  // Right Roller Support B
        } else if (this.beamType === 'cantilever') {
            drawFixedSupport(p0, true);      // Left Fixed Wall
        } else if (this.beamType === 'fixed') {
            drawFixedSupport(p0, true);      // Left Fixed Wall
            drawFixedSupport(pL, false);     // Right Fixed Wall
        } else if (this.beamType === 'overhanging') {
            // Drag support highlights
            ctx.fillStyle = (this.hoveredSupportType === 'a') ? '#3b82f6' : (isDark ? '#4b5563' : '#64748b');
            drawTriangleSupport(this.meterToPixel(this.supports.a), true);
            
            ctx.fillStyle = (this.hoveredSupportType === 'b') ? '#3b82f6' : (isDark ? '#4b5563' : '#64748b');
            drawTriangleSupport(this.meterToPixel(this.supports.b), false);
        }
    }

    drawReactionForces(isDark) {
        const ctx = this.ctx;
        ctx.strokeStyle = '#10b981'; // Green for reactions
        ctx.fillStyle = '#10b981';
        ctx.lineWidth = 2.5;
        ctx.font = 'bold 11px var(--font-mono)';

        const drawArrow = (px, val, label) => {
            const startY = this.beamY + this.beamHeight + 50;
            const endY = this.beamY + this.beamHeight + 5;
            
            // Line
            ctx.beginPath();
            ctx.moveTo(px, startY);
            ctx.lineTo(px, endY);
            ctx.stroke();
            
            // Arrowhead
            ctx.beginPath();
            ctx.moveTo(px, endY);
            ctx.lineTo(px - 5, endY + 7);
            ctx.lineTo(px + 5, endY + 7);
            ctx.fill();

            // Label text
            ctx.textAlign = 'center';
            ctx.fillText(`${label} = ${val.toFixed(2)} kN`, px, startY + 12);
        };

        const drawMomentReaction = (px, val, isLeft) => {
            ctx.beginPath();
            // Draw a circular arc representing reacting moment (Counter-clockwise if loads are downward)
            ctx.arc(px + (isLeft ? 15 : -15), this.beamY + 6, 20, 0.7 * Math.PI, 1.7 * Math.PI, false);
            ctx.stroke();

            // Arrow head
            const arrowX = px + (isLeft ? 15 : -15) + 20 * Math.cos(1.7 * Math.PI);
            const arrowY = this.beamY + 6 + 20 * Math.sin(1.7 * Math.PI);
            ctx.beginPath();
            ctx.moveTo(arrowX, arrowY);
            ctx.lineTo(arrowX + 2, arrowY + 6);
            ctx.lineTo(arrowX - 6, arrowY + 3);
            ctx.fill();

            ctx.fillText(`M = ${val.toFixed(1)} kNm`, px + (isLeft ? 25 : -25), this.beamY - 18);
        };

        const p0 = this.meterToPixel(0);
        const pL = this.meterToPixel(this.beamLength);

        if (this.beamType === 'simply_supported') {
            drawArrow(p0, this.reactions.RA, 'R_A');
            drawArrow(pL, this.reactions.RB, 'R_B');
        } else if (this.beamType === 'cantilever') {
            drawArrow(p0, this.reactions.RA, 'R_A');
            if (Math.abs(this.reactions.MA) > 0.01) {
                drawMomentReaction(p0, this.reactions.MA, true);
            }
        } else if (this.beamType === 'fixed') {
            drawArrow(p0, this.reactions.RA, 'R_A');
            drawArrow(pL, this.reactions.RB, 'R_B');
            if (Math.abs(this.reactions.MA) > 0.01) drawMomentReaction(p0, this.reactions.MA, true);
            if (Math.abs(this.reactions.MB) > 0.01) drawMomentReaction(pL, this.reactions.MB, false);
        } else if (this.beamType === 'overhanging') {
            drawArrow(this.meterToPixel(this.supports.a), this.reactions.RA, 'R_A');
            drawArrow(this.meterToPixel(this.supports.b), this.reactions.RB, 'R_B');
        }
    }

    drawLoads(isDark) {
        const ctx = this.ctx;
        
        ctx.font = '600 11px Inter, sans-serif';
        ctx.textAlign = 'center';

        this.loads.forEach((load, idx) => {
            const isHovered = (this.hoveredLoadIdx === idx || this.draggedLoadIdx === idx);
            
            if (load.type === 'point') {
                ctx.strokeStyle = isHovered ? '#3b82f6' : '#ef4444'; // Red for point loads
                ctx.fillStyle = isHovered ? '#3b82f6' : '#ef4444';
                ctx.lineWidth = 3;

                const px = this.meterToPixel(load.position);
                const startY = this.beamY - 45;
                const endY = this.beamY - 3;

                // Arrow line
                ctx.beginPath();
                ctx.moveTo(px, startY);
                ctx.lineTo(px, endY);
                ctx.stroke();

                // Arrowhead
                ctx.beginPath();
                ctx.moveTo(px, endY);
                ctx.lineTo(px - 6, endY - 8);
                ctx.lineTo(px + 6, endY - 8);
                ctx.fill();

                // Draggable handle head
                ctx.beginPath();
                ctx.arc(px, startY, 5, 0, Math.PI * 2);
                ctx.fill();

                // Magnitude text
                ctx.fillStyle = isDark ? '#f9fafb' : '#0f172a';
                ctx.fillText(`${load.magnitude} kN`, px, startY - 10);
                ctx.fillStyle = isDark ? '#9ca3af' : '#475569';
                ctx.fillText(`x=${load.position}m`, px, startY - 22);

            } else if (load.type === 'udl') {
                ctx.strokeStyle = isHovered ? '#3b82f6' : '#0d9488'; // Teal for UDL
                ctx.fillStyle = isHovered ? 'rgba(59, 130, 246, 0.15)' : 'rgba(13, 148, 136, 0.15)';
                ctx.lineWidth = 2.5;

                const pStart = this.meterToPixel(load.start);
                const pEnd = this.meterToPixel(load.end);
                const width = pEnd - pStart;
                const topY = this.beamY - 22;

                // Draw solid bounding outline with diagonal hatchings inside
                ctx.beginPath();
                ctx.rect(pStart, topY, width, 22);
                ctx.fill();
                ctx.stroke();

                // Diagonal internal lines
                ctx.save();
                ctx.rect(pStart, topY, width, 22);
                ctx.clip();
                ctx.beginPath();
                for (let j = pStart - 20; j < pEnd + 20; j += 10) {
                    ctx.moveTo(j, this.beamY);
                    ctx.lineTo(j + 20, topY);
                }
                ctx.stroke();
                ctx.restore();

                // Text labels at center
                const pCenter = (pStart + pEnd) / 2;
                ctx.fillStyle = isDark ? '#f9fafb' : '#0f172a';
                ctx.fillText(`${load.magnitude} kN/m`, pCenter, topY - 10);
                ctx.fillStyle = isDark ? '#9ca3af' : '#475569';
                ctx.fillText(`span:${load.start}-${load.end}m`, pCenter, topY - 22);

            } else if (load.type === 'moment') {
                ctx.strokeStyle = isHovered ? '#3b82f6' : '#8b5cf6'; // Purple for moment
                ctx.fillStyle = isHovered ? '#3b82f6' : '#8b5cf6';
                ctx.lineWidth = 2.5;

                const px = this.meterToPixel(load.position);
                const centY = this.beamY - 20;

                // Draw circular arrow (clockwise or counter-clockwise)
                ctx.beginPath();
                // 3/4 circle
                const isClockwise = load.magnitude >= 0;
                ctx.arc(px, centY, 15, 0.2 * Math.PI, 1.8 * Math.PI, !isClockwise);
                ctx.stroke();

                // Arrow head
                const tipAngle = isClockwise ? 0.2 * Math.PI : 1.8 * Math.PI;
                const arrowX = px + 15 * Math.cos(tipAngle);
                const arrowY = centY + 15 * Math.sin(tipAngle);
                ctx.beginPath();
                ctx.moveTo(arrowX, arrowY);
                if (isClockwise) {
                    ctx.lineTo(arrowX - 8, arrowY - 2);
                    ctx.lineTo(arrowX - 4, arrowY + 6);
                } else {
                    ctx.lineTo(arrowX - 8, arrowY + 2);
                    ctx.lineTo(arrowX - 4, arrowY - 6);
                }
                ctx.fill();

                // Text labels
                ctx.fillStyle = isDark ? '#f9fafb' : '#0f172a';
                ctx.fillText(`${Math.abs(load.magnitude)} kNm`, px, centY - 22);
                ctx.fillStyle = isDark ? '#9ca3af' : '#475569';
                ctx.fillText(`${isClockwise ? 'CW' : 'CCW'} at x=${load.position}m`, px, centY - 33);
            }
        });
    }

    /**
     * Instantiates or refreshes the Chart.js diagrams.
     */
    plotDiagrams(sfdData, bmdData, deflectionData, summary) {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const gridColor = isDark ? '#1f2937' : '#e2e8f0';
        const textColor = isDark ? '#9ca3af' : '#475569';

        // Helper to extract x coordinates and clean duplicate values for labels
        const xLabels = sfdData.map(pt => pt.x.toFixed(2));
        
        // 1. Plot Shear Force Diagram (SFD)
        const sfdCtx = document.getElementById(this.sfdId).getContext('2d');
        const sfdGradient = sfdCtx.createLinearGradient(0, 0, 0, 200);
        sfdGradient.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
        sfdGradient.addColorStop(1, 'rgba(59, 130, 246, 0.05)');

        if (this.sfdChart) this.sfdChart.destroy();
        this.sfdChart = new Chart(sfdCtx, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Shear Force (kN)',
                    data: sfdData,
                    borderColor: '#3b82f6',
                    borderWidth: 2,
                    backgroundColor: sfdGradient,
                    fill: 'origin',
                    tension: 0,
                    pointRadius: 0,
                    pointHoverRadius: 5
                }]
            },
            options: this.getChartOptions(gridColor, textColor, 'kN', summary.absMaxSF)
        });

        // 2. Plot Bending Moment Diagram (BMD)
        const bmdCtx = document.getElementById(this.bmdId).getContext('2d');
        const bmdGradient = bmdCtx.createLinearGradient(0, 0, 0, 200);
        bmdGradient.addColorStop(0, 'rgba(139, 92, 246, 0.4)');
        bmdGradient.addColorStop(1, 'rgba(139, 92, 246, 0.05)');

        if (this.bmdChart) this.bmdChart.destroy();
        this.bmdChart = new Chart(bmdCtx, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Bending Moment (kNm)',
                    data: bmdData,
                    borderColor: '#8b5cf6',
                    borderWidth: 2,
                    backgroundColor: bmdGradient,
                    fill: 'origin',
                    tension: 0.01,
                    pointRadius: 0,
                    pointHoverRadius: 5
                }]
            },
            options: this.getChartOptions(gridColor, textColor, 'kNm', summary.absMaxBM)
        });

        // 3. Plot Deflection Curve
        const deflCtx = document.getElementById(this.deflectionId).getContext('2d');
        if (this.deflectionChart) this.deflectionChart.destroy();
        this.deflectionChart = new Chart(deflCtx, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Deflection (mm)',
                    data: deflectionData,
                    borderColor: '#10b981',
                    borderWidth: 2,
                    backgroundColor: 'transparent',
                    tension: 0.1,
                    pointRadius: 0,
                    pointHoverRadius: 5
                }]
            },
            options: this.getChartOptions(gridColor, textColor, 'mm', summary.absMaxDefl)
        });
    }

    /**
     * Generates a standard set of responsive configuration options for Chart.js.
     */
    getChartOptions(gridColor, textColor, unit, maxVal) {
        // Set scale margins
        const limit = Math.max(1.0, maxVal * 1.15);
        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 400
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        title: (items) => `Position: ${parseFloat(items[0].raw.x).toFixed(2)} m`,
                        label: (item) => `Value: ${parseFloat(item.raw.y).toFixed(2)} ${unit}`
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    title: {
                        display: true,
                        text: 'Beam Position (m)',
                        color: textColor,
                        font: { size: 10, weight: '600' }
                    },
                    grid: { color: gridColor },
                    ticks: { color: textColor }
                },
                y: {
                    title: {
                        display: true,
                        text: `[${unit}]`,
                        color: textColor,
                        font: { size: 10, weight: '600' }
                    },
                    grid: { color: gridColor },
                    ticks: { color: textColor },
                    min: -limit,
                    max: limit
                }
            }
        };
    }
}

window.BeamDiagrams = BeamDiagrams;
