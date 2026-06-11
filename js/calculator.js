/**
 * BeamMaster AI - Structural Engineering Calculation Engine
 * 
 * Standard Sign Conventions:
 * - Distance (x): Measured from the left end (x = 0) to the right end (x = L).
 * - Forces: Upward reactions are positive (+), downward loads are positive in inputs but negative in equilibrium equations.
 * - Shear Force (V): Upward force on the left of a section is positive (+). Downward on the left is negative (-).
 * - Bending Moment (M): Sagging bending moment (clockwise on left, counter-clockwise on right) is positive (+). Hogging is negative (-).
 * - Concentrated Moment: Clockwise applied moment is positive (+), causing a positive jump (+M) from left to right.
 * - Deflection (y): Downward deflection is negative (-) or positive depending on presentation; here we calculate y as physical position (downward is negative displacement).
 */

class BeamCalculator {
    /**
     * Solves the beam and returns reactions, SFD/BMD curves, deflection, and a step-by-step report.
     * @param {Object} config
     * @param {string} config.type - 'simply_supported', 'cantilever', 'fixed', 'overhanging'
     * @param {number} config.length - Beam length in meters
     * @param {Object} config.supports - Support locations { a: number, b: number }
     * @param {Array} config.loads - Array of load objects
     * @param {number} config.E - Young's Modulus in GPa
     * @param {number} config.I - Moment of Inertia in cm^4
     */
    static solve(config) {
        const L = parseFloat(config.length);
        const type = config.type;
        const loads = config.loads || [];
        const E_gpa = parseFloat(config.E) || 200;
        const I_cm4 = parseFloat(config.I) || 5000;
        
        // Convert E (GPa) and I (cm^4) to SI Units (N/m^2 and m^4)
        // E: GPa = 10^9 N/m^2
        // I: cm^4 = 10^-8 m^4
        // EI = E * 10^9 * I * 10^-8 = E * I * 10 N-m^2
        const EI = E_gpa * 1e9 * I_cm4 * 1e-8; // N*m^2

        // Support Positions
        let x_A = 0;
        let x_B = L;
        if (type === 'overhanging') {
            x_A = parseFloat(config.supports.a);
            x_B = parseFloat(config.supports.b);
            if (x_A > x_B) {
                const temp = x_A;
                x_A = x_B;
                x_B = temp;
            }
        } else if (type === 'cantilever') {
            x_A = 0; // Clamped support at x = 0
            x_B = 0;
        } else if (type === 'fixed') {
            x_A = 0;
            x_B = L;
        }

        // 1. Calculate Reactions and create Step-by-Step details
        const { reactions, stepByStep } = this.calculateReactions(type, L, x_A, x_B, loads);

        // 2. Generate Grid of Discontinuity points for clean plotting
        const keyPoints = this.getDiscontinuityPoints(L, x_A, x_B, type, loads);
        
        // 3. Compute Shear Force (V), Bending Moment (M) and Curvature (M/EI) curves
        const sfdData = [];
        const bmdData = [];
        const curvatureData = []; // for deflection integration

        for (const x of keyPoints) {
            const sf = this.getShearForce(x, type, L, x_A, x_B, reactions, loads);
            const bm = this.getBendingMoment(x, type, L, x_A, x_B, reactions, loads);
            
            sfdData.push({ x: x, y: sf });
            bmdData.push({ x: x, y: bm });
            curvatureData.push({ x: x, y: bm / EI });
        }

        // 4. Double integration for Deflection
        const deflectionData = this.calculateDeflections(keyPoints, curvatureData, type, x_A, x_B, L);

        // 5. Compute max/min summary values
        const summary = this.getSummaryResults(sfdData, bmdData, deflectionData);

        return {
            reactions,
            sfdData,
            bmdData,
            deflectionData,
            summary,
            stepByStep,
            EI
        };
    }

    /**
     * Computes the reaction forces and moments at supports.
     */
    static calculateReactions(type, L, x_A, x_B, loads) {
        let RA = 0, RB = 0, MA = 0, MB = 0;
        const steps = [];

        // Sum of all downward forces (kN)
        let totalForce = 0;
        let forceExplanation = [];
        
        loads.forEach((load, idx) => {
            if (load.type === 'point') {
                totalForce += load.magnitude;
                forceExplanation.push(`${load.magnitude} kN (Point Load #${idx + 1})`);
            } else if (load.type === 'udl') {
                const len = load.end - load.start;
                const totalUdl = load.magnitude * len;
                totalForce += totalUdl;
                forceExplanation.push(`(${load.magnitude} kN/m × ${len} m = ${totalUdl.toFixed(2)} kN) (UDL #${idx + 1})`);
            }
        });

        steps.push(`<h4>1. Total Applied Loads</h4>`);
        if (loads.length === 0) {
            steps.push(`No loads applied. The beam is self-weightless under ideal structural analysis conditions.`);
        } else {
            steps.push(`Total vertical load $F_{\\text{total}} = \\sum P_i + \\sum (w_i \\cdot L_i) = ${forceExplanation.join(' + ')} = <strong>${totalForce.toFixed(2)} kN</strong>.`);
        }

        // Simple Supported & Overhanging
        if (type === 'simply_supported' || type === 'overhanging') {
            const dSupports = x_B - x_A;
            steps.push(`<h4>2. Support Reactions</h4>`);
            steps.push(`Let's apply static equilibrium equations:`);
            steps.push(`$\\sum M_A = 0$: Take moments about left support A (at $x_A = ${x_A}$ m) to solve for $R_B$:`);
            
            let momentA_sum = 0;
            let momentTerms = [];

            loads.forEach((load, idx) => {
                if (load.type === 'point') {
                    const leverArm = load.position - x_A;
                    const mom = load.magnitude * leverArm;
                    momentA_sum += mom;
                    momentTerms.push(`[${load.magnitude} kN × (${load.position} - ${x_A}) m = ${mom.toFixed(2)} kNm]`);
                } else if (load.type === 'udl') {
                    const len = load.end - load.start;
                    const totalUdl = load.magnitude * len;
                    const centroid = (load.start + load.end) / 2;
                    const leverArm = centroid - x_A;
                    const mom = totalUdl * leverArm;
                    momentA_sum += mom;
                    momentTerms.push(`[(${load.magnitude} kN/m × ${len} m) × (${centroid.toFixed(2)} - ${x_A}) m = ${mom.toFixed(2)} kNm]`);
                } else if (load.type === 'moment') {
                    // Moment loads (clockwise is positive moment sum)
                    momentA_sum += load.magnitude;
                    momentTerms.push(`[${load.magnitude} kNm (Moment Load)]`);
                }
            });

            if (momentTerms.length > 0) {
                steps.push(`Moment sum about Support A: $M_{\\text{loads}} = ${momentTerms.join(' + ')} = ${momentA_sum.toFixed(2)} kNm$.`);
            } else {
                steps.push(`Moment sum about Support A: $M_{\\text{loads}} = 0$ kNm.`);
            }

            steps.push(`Reaction $R_B$ acts at distance $x_B - x_A = ${dSupports.toFixed(2)}$ m from Support A.`);
            steps.push(`$R_B \\times ${dSupports.toFixed(2)} = ${momentA_sum.toFixed(2)} \\implies R_B = \\frac{${momentA_sum.toFixed(2)}}{${dSupports.toFixed(2)}} = <strong>${(momentA_sum / dSupports).toFixed(2)} kN</strong>.`);
            
            RB = momentA_sum / dSupports;
            RA = totalForce - RB;

            steps.push(`$\\sum F_y = 0$: $R_A + R_B = F_{\\text{total}} \\implies R_A = ${totalForce.toFixed(2)} - ${RB.toFixed(2)} = <strong>${RA.toFixed(2)} kN</strong>.`);
            
            return { reactions: { RA, RB, MA: 0, MB: 0 }, stepByStep: steps };
        }

        // Cantilever (Fixed at Left)
        if (type === 'cantilever') {
            steps.push(`<h4>2. Support Reactions (Fixed End at x = 0)</h4>`);
            steps.push(`For a Cantilever beam, all reactions are located at the fixed support A:`);
            steps.push(`Vertical reaction: $R_A = F_{\\text{total}} = <strong>${totalForce.toFixed(2)} kN</strong>.`);
            
            RA = totalForce;
            RB = 0;

            let momentSum = 0;
            let momentTerms = [];

            loads.forEach((load, idx) => {
                if (load.type === 'point') {
                    const mom = load.magnitude * load.position;
                    momentSum += mom;
                    momentTerms.push(`[${load.magnitude} kN × ${load.position} m = ${mom.toFixed(2)} kNm]`);
                } else if (load.type === 'udl') {
                    const len = load.end - load.start;
                    const totalUdl = load.magnitude * len;
                    const centroid = (load.start + load.end) / 2;
                    const mom = totalUdl * centroid;
                    momentSum += mom;
                    momentTerms.push(`[(${load.magnitude} kN/m × ${len} m) × ${centroid.toFixed(2)} m = ${mom.toFixed(2)} kNm]`);
                } else if (load.type === 'moment') {
                    momentSum += load.magnitude;
                    momentTerms.push(`[${load.magnitude} kNm (Moment)]`);
                }
            });

            if (momentTerms.length > 0) {
                steps.push(`Bending Moment sum at x = 0: $M_A = \\sum P_i x_i + \\sum (w_i L_i c_i) + \\sum M_{moment} = ${momentTerms.join(' + ')} = <strong>${momentSum.toFixed(2)} kNm</strong>.`);
            } else {
                steps.push(`Bending Moment at x = 0: $M_A = 0$ kNm.`);
            }
            steps.push(`This clamping moment $M_A$ acts counter-clockwise to resist the clockwise moments from loads.`);
            MA = momentSum;

            return { reactions: { RA, RB, MA, MB: 0 }, stepByStep: steps };
        }

        // Fixed Beam (Fixed at x = 0 and x = L)
        if (type === 'fixed') {
            steps.push(`<h4>2. Fixed End Moments & Reactions (Statically Indeterminate)</h4>`);
            steps.push(`A fixed beam has 4 reaction components ($R_A, R_B, M_A, M_B$). It is solved using the Force Method / Superposition:`);

            let totalMA = 0;
            let totalMB = 0;
            let rA_ss_sum = 0; // simply supported equivalent reactions
            
            let femTermsA = [];
            let femTermsB = [];

            loads.forEach((load, idx) => {
                if (load.type === 'point') {
                    const a = load.position;
                    const b = L - a;
                    const ma = (load.magnitude * a * b * b) / (L * L);
                    const mb = (load.magnitude * a * a * b) / (L * L);
                    totalMA += ma;
                    totalMB += mb;
                    rA_ss_sum += load.magnitude * (b / L);
                    femTermsA.push(`[(${load.magnitude} × ${a} × ${b.toFixed(2)}^2) / ${L}^2 = ${ma.toFixed(2)} kNm]`);
                    femTermsB.push(`[(${load.magnitude} × ${a}^2 × ${b.toFixed(2)}) / ${L}^2 = ${mb.toFixed(2)} kNm]`);
                } else if (load.type === 'udl') {
                    // Integrate point load FEM equations for partial UDL
                    // Int_x1_x2 (w * x * (L-x)^2 / L^2) dx
                    const w = load.magnitude;
                    const x1 = load.start;
                    const x2 = load.end;
                    
                    const evalMA = (x) => (w / (L * L)) * (L * L * x * x / 2 - 2 * L * x * x * x / 3 + x * x * x * x / 4);
                    const evalMB = (x) => (w / (L * L)) * (L * x * x * x / 3 - x * x * x * x / 4);
                    
                    const ma = evalMA(x2) - evalMA(x1);
                    const mb = evalMB(x2) - evalMB(x1);
                    
                    totalMA += ma;
                    totalMB += mb;
                    
                    const len = x2 - x1;
                    const centroid = (x1 + x2) / 2;
                    rA_ss_sum += w * len * ((L - centroid) / L);
                    
                    femTermsA.push(`[UDL Integration = ${ma.toFixed(2)} kNm]`);
                    femTermsB.push(`[UDL Integration = ${mb.toFixed(2)} kNm]`);
                } else if (load.type === 'moment') {
                    const a = load.position;
                    const b = L - a;
                    const ma = (load.magnitude * b * (2 * a - b)) / (L * L);
                    const mb = (load.magnitude * a * (2 * b - a)) / (L * L);
                    totalMA += ma;
                    totalMB += mb;
                    rA_ss_sum += -load.magnitude / L;
                    femTermsA.push(`[(${load.magnitude} × ${b.toFixed(2)} × (2×${a} - ${b.toFixed(2)})) / ${L}^2 = ${ma.toFixed(2)} kNm]`);
                    femTermsB.push(`[(${load.magnitude} × ${a} × (2×${b.toFixed(2)} - ${a})) / ${L}^2 = ${mb.toFixed(2)} kNm]`);
                }
            });

            if (femTermsA.length > 0) {
                steps.push(`Left Fixed-End Moment: $M_A = \\sum M_{A,i} = ${femTermsA.join(' + ')} = <strong>${totalMA.toFixed(2)} kNm</strong> (Counter-clockwise).`);
                steps.push(`Right Fixed-End Moment: $M_B = \\sum M_{B,i} = ${femTermsB.join(' + ')} = <strong>${totalMB.toFixed(2)} kNm</strong> (Clockwise).`);
            } else {
                steps.push(`No active loads; fixed-end moments $M_A = M_B = 0$ kNm.`);
            }

            MA = totalMA;
            MB = totalMB;

            // Compute vertical reactions: RA = R_ss + (MA - MB)/L
            RA = rA_ss_sum + (MA - MB) / L;
            RB = totalForce - RA;

            steps.push(`Vertical reaction at Support A: $R_A = R_{A,\\text{simply\\_supported}} + \\frac{M_A - M_B}{L} = ${rA_ss_sum.toFixed(2)} + \\frac{${MA.toFixed(2)} - ${MB.toFixed(2)}}{${L}} = <strong>${RA.toFixed(2)} kN</strong>.`);
            steps.push(`Vertical reaction at Support B: $R_B = F_{\\text{total}} - R_A = ${totalForce.toFixed(2)} - ${RA.toFixed(2)} = <strong>${RB.toFixed(2)} kN</strong>.`);
            
            return { reactions: { RA, RB, MA, MB }, stepByStep: steps };
        }

        return { reactions: { RA: 0, RB: 0, MA: 0, MB: 0 }, stepByStep: ["Undefined beam type"] };
    }

    /**
     * Determines all discontinuity and interest coordinates along the beam,
     * adding slight offsets (epsilon) around them to plot vertical segments accurately.
     */
    static getDiscontinuityPoints(L, x_A, x_B, type, loads) {
        const eps = 1e-9;
        const coords = new Set();
        
        // Boundaries
        coords.add(0);
        coords.add(L);

        // Supports
        if (type === 'simply_supported' || type === 'overhanging') {
            coords.add(x_A);
            coords.add(x_B);
        }

        // Loads boundaries
        loads.forEach(load => {
            if (load.type === 'point') {
                coords.add(load.position);
            } else if (load.type === 'udl') {
                coords.add(load.start);
                coords.add(load.end);
            } else if (load.type === 'moment') {
                coords.add(load.position);
            }
        });

        // Add standard interval samples (e.g., 200 points across the beam length)
        const numIntervals = 200;
        for (let i = 0; i <= numIntervals; i++) {
            const px = (i / numIntervals) * L;
            coords.add(px);
        }

        // Convert set to array, sort numerically
        const sortedCoords = Array.from(coords).sort((a, b) => a - b);
        
        // Add epsilon offsets just before and just after key structural coordinates (loads/supports)
        const finalCoords = new Set();
        sortedCoords.forEach(x => {
            // Keep points within beam boundary [0, L]
            if (x >= 0 && x <= L) {
                finalCoords.add(x);
            }
            if (x - eps >= 0) finalCoords.add(x - eps);
            if (x + eps <= L) finalCoords.add(x + eps);
        });

        return Array.from(finalCoords).sort((a, b) => a - b);
    }

    /**
     * Computes the Shear Force at position x.
     */
    static getShearForce(x, type, L, x_A, x_B, reactions, loads) {
        let sf = 0;

        // Support Reactions to the left of x
        if (type === 'simply_supported' || type === 'overhanging') {
            if (x_A < x) sf += reactions.RA;
            if (x_B < x) sf += reactions.RB;
        } else if (type === 'cantilever') {
            if (0 < x) sf += reactions.RA; // Fixed end vertical reaction at x=0
        } else if (type === 'fixed') {
            if (0 < x) sf += reactions.RA; // Fixed end at x=0
            if (L < x) sf += reactions.RB; // Fixed end at x=L (normally x <= L, so this won't trigger unless x > L)
        }

        // Applied loads to the left of x
        loads.forEach(load => {
            if (load.type === 'point') {
                if (load.position < x) {
                    sf -= load.magnitude;
                }
            } else if (load.type === 'udl') {
                if (load.start < x) {
                    const loadedLen = Math.max(0, Math.min(x, load.end) - load.start);
                    sf -= load.magnitude * loadedLen;
                }
            }
            // Moment loads do not affect shear force diagram directly
        });

        return sf;
    }

    /**
     * Computes Bending Moment at position x (sagging is positive).
     */
    static getBendingMoment(x, type, L, x_A, x_B, reactions, loads) {
        let bm = 0;

        // Moments of support reaction forces to the left of x
        if (type === 'simply_supported' || type === 'overhanging') {
            if (x_A < x) bm += reactions.RA * (x - x_A);
            if (x_B < x) bm += reactions.RB * (x - x_B);
        } else if (type === 'cantilever') {
            if (0 < x) {
                bm += reactions.RA * x;
                bm -= reactions.MA; // Counter-clockwise reaction moment causes hogging (negative moment)
            }
        } else if (type === 'fixed') {
            if (0 < x) {
                bm += reactions.RA * x;
                bm -= reactions.MA; // Left support fixed end moment MA
            }
        }

        // Moments of applied loads to the left of x
        loads.forEach(load => {
            if (load.type === 'point') {
                if (load.position < x) {
                    bm -= load.magnitude * (x - load.position);
                }
            } else if (load.type === 'udl') {
                if (load.start < x) {
                    const loadedLen = Math.max(0, Math.min(x, load.end) - load.start);
                    const centroid = load.start + (loadedLen / 2);
                    bm -= (load.magnitude * loadedLen) * (x - centroid);
                }
            } else if (load.type === 'moment') {
                // Clockwise concentrated moment applied to the left of x
                if (load.position < x) {
                    bm += load.magnitude;
                }
            }
        });

        return bm;
    }

    /**
     * Performs double integration of bending moments to find beam deflections.
     * Uses Trapezoidal rule integration.
     */
    static calculateDeflections(xGrid, curvatureGrid, type, x_A, x_B, L) {
        const N = xGrid.length;
        
        // 1. First integration to get slope theta(x) - Constant slope C1 is unknown
        // I1(x) = Int_0_x (M/EI) dx
        const I1 = new Array(N).fill(0);
        for (let i = 1; i < N; i++) {
            const h = xGrid[i] - xGrid[i-1];
            const avgY = (curvatureGrid[i].y + curvatureGrid[i-1].y) / 2;
            I1[i] = I1[i-1] + avgY * h;
        }

        // 2. Second integration to get displacement y_raw(x)
        // I2(x) = Int_0_x I1(s) ds
        const I2 = new Array(N).fill(0);
        for (let i = 1; i < N; i++) {
            const h = xGrid[i] - xGrid[i-1];
            const avgY = (I1[i] + I1[i-1]) / 2;
            I2[i] = I2[i-1] + avgY * h;
        }

        // Slope: theta(x) = C1 + I1(x)
        // Deflection: y(x) = C2 + C1*x + I2(x)
        let C1 = 0;
        let C2 = 0;

        // Apply boundary conditions to find C1 and C2:
        if (type === 'cantilever') {
            // Fixed at x = 0: deflection(0) = 0, slope(0) = 0
            // Since our integration started from 0, I1(0) = 0 and I2(0) = 0.
            // Therefore C1 = 0, C2 = 0.
            C1 = 0;
            C2 = 0;
        } else if (type === 'simply_supported' || type === 'overhanging') {
            // Deflection = 0 at supports: y(x_A) = 0 and y(x_B) = 0
            // C2 + C1 * x_A + I2(x_A) = 0
            // C2 + C1 * x_B + I2(x_B) = 0
            // Subtracting these: C1 * (x_B - x_A) + I2(x_B) - I2(x_A) = 0
            // => C1 = (I2(x_A) - I2(x_B)) / (x_B - x_A)
            // => C2 = -C1 * x_A - I2(x_A)
            
            // Find index corresponding to x_A and x_B
            // Since x_A and x_B are added to the grid, we can interpolate exactly or query values.
            const getI2Val = (targetX) => {
                // Find closest element
                let bestIdx = 0;
                let minDist = Infinity;
                for (let i = 0; i < N; i++) {
                    const dist = Math.abs(xGrid[i] - targetX);
                    if (dist < minDist) {
                        minDist = dist;
                        bestIdx = i;
                    }
                }
                return I2[bestIdx];
            };

            const I2_A = getI2Val(x_A);
            const I2_B = getI2Val(x_B);
            
            const dist = x_B - x_A;
            if (dist > 0.001) {
                C1 = (I2_A - I2_B) / dist;
                C2 = -C1 * x_A - I2_A;
            } else {
                C1 = 0;
                C2 = 0;
            }
        } else if (type === 'fixed') {
            // Fixed at x = 0 and x = L: y(0) = 0, y(L) = 0, slope(0) = 0, slope(L) = 0.
            // Since we integrated using fixed-end reactions MA and MB calculated analytically,
            // y(0) = 0 => C2 = 0.
            // slope(0) = 0 => C1 = 0.
            C1 = 0;
            C2 = 0;
        }

        // 3. Compute final deflections (in millimeters for friendly engineering units)
        // y(x) = C2 + C1 * x + I2(x)
        // Expressed in mm: y * 1000
        const deflectionData = [];
        for (let i = 0; i < N; i++) {
            const rawY = C2 + C1 * xGrid[i] + I2[i];
            const defl_mm = rawY * 1000;
            deflectionData.push({ x: xGrid[i], y: defl_mm });
        }

        return deflectionData;
    }

    /**
     * Evaluates maximum and minimum values in the curves.
     */
    static getSummaryResults(sfd, bmd, deflection) {
        let maxSF = -Infinity;
        let minSF = Infinity;
        let absMaxSF = 0;
        let maxSF_x = 0;

        let maxBM = -Infinity;
        let minBM = Infinity;
        let absMaxBM = 0;
        let maxBM_x = 0;

        let maxDefl = -Infinity;
        let minDefl = Infinity;
        let absMaxDefl = 0;
        let maxDefl_x = 0;

        // Process SFD
        sfd.forEach(pt => {
            if (pt.y > maxSF) maxSF = pt.y;
            if (pt.y < minSF) minSF = pt.y;
            
            if (Math.abs(pt.y) > absMaxSF) {
                absMaxSF = Math.abs(pt.y);
                maxSF_x = pt.x;
            }
        });

        // Process BMD
        bmd.forEach(pt => {
            if (pt.y > maxBM) maxBM = pt.y;
            if (pt.y < minBM) minBM = pt.y;
            
            if (Math.abs(pt.y) > absMaxBM) {
                absMaxBM = Math.abs(pt.y);
                maxBM_x = pt.x;
            }
        });

        // Process Deflection (in mm)
        deflection.forEach(pt => {
            if (pt.y > maxDefl) maxDefl = pt.y;
            if (pt.y < minDefl) minDefl = pt.y;
            
            if (Math.abs(pt.y) > absMaxDefl) {
                absMaxDefl = Math.abs(pt.y);
                maxDefl_x = pt.x;
            }
        });

        // Points of contraflexure (where Bending Moment changes sign)
        const contraflexurePoints = [];
        for (let i = 1; i < bmd.length; i++) {
            const pt1 = bmd[i-1];
            const pt2 = bmd[i];
            
            // Check sign change, and verify it's not a tiny numerical glitch or duplicate point
            if (pt1.y * pt2.y < -1e-5 && Math.abs(pt1.x - pt2.x) > 1e-4) {
                // Linear interpolation to find x where bm = 0
                const fraction = Math.abs(pt1.y) / (Math.abs(pt1.y) + Math.abs(pt2.y));
                const zeroX = pt1.x + fraction * (pt2.x - pt1.x);
                contraflexurePoints.push(parseFloat(zeroX.toFixed(3)));
            }
        }

        // Clean duplicates in contraflexure points
        const uniqueContraflexure = Array.from(new Set(contraflexurePoints)).sort((a, b) => a - b);

        return {
            maxSF: maxSF === -Infinity ? 0 : maxSF,
            minSF: minSF === Infinity ? 0 : minSF,
            absMaxSF,
            maxSF_x: parseFloat(maxSF_x.toFixed(3)),
            maxBM: maxBM === -Infinity ? 0 : maxBM,
            minBM: minBM === Infinity ? 0 : minBM,
            absMaxBM,
            maxBM_x: parseFloat(maxBM_x.toFixed(3)),
            maxDefl: maxDefl === -Infinity ? 0 : maxDefl,
            minDefl: minDefl === Infinity ? 0 : minDefl,
            absMaxDefl,
            maxDefl_x: parseFloat(maxDefl_x.toFixed(3)),
            contraflexure: uniqueContraflexure
        };
    }
}
window.BeamCalculator = BeamCalculator;
