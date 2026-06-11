/**
 * BeamMaster AI - AI Engineering Assistant Chatbot Engine
 */

class AIAssistant {
    constructor() {
        // Pre-programmed Q&A knowledge base
        this.knowledgeBase = {
            greetings: {
                keywords: ["hello", "hi", "hey", "greet", "start", "help", "who are you"],
                reply: `👋 Hello! I am your <strong>BeamMaster AI Engineering Assistant</strong>.<br><br>
                       I can help you with:<br>
                       • Explaining SFD and BMD principles<br>
                       • Solving structural engineering equations<br>
                       • Explaining sign conventions (sagging/hogging)<br>
                       • Analyzing your live calculation dashboard! Click <strong>"Explain Active Beam"</strong> below or type "analyze beam" to get a step-by-step summary.`
            },
            sfd: {
                keywords: ["sfd", "shear force", "shear diagram", "what is shear"],
                reply: `📝 <strong>Shear Force (V)</strong> at any point along a beam represents the internal force resisting transverse sliding between adjacent cross-sections.<br><br>
                       <strong>Mathematical Definition:</strong><br>
                       The shear force is the algebraic sum of all vertical forces (both reactions and applied loads) acting on one side of the cross-section (usually summing from the left end $x=0$).<br><br>
                       <strong>Sign Convention:</strong><br>
                       • Positive (+) Shear: Upward force on the left of the section, pushing it up relative to the right.<br>
                       • Negative (-) Shear: Downward force on the left of the section.<br><br>
                       <strong>Key Tip:</strong> Concentrated point loads cause an instantaneous vertical drop or jump in the shear force diagram equal to the load magnitude.`
            },
            bmd: {
                keywords: ["bmd", "bending moment", "flexure", "bending diagram"],
                reply: `📐 <strong>Bending Moment (M)</strong> is the internal rotational effect at any cross-section caused by lateral loading.<br><br>
                       <strong>Sign Convention (Sagging vs. Hogging):</strong><br>
                       • <strong>Sagging (Positive +):</strong> Bends the beam into a smiley face curve (tension in bottom fibers, compression in top). Caused by downward loads in a simply supported span.<br>
                       • <strong>Hogging (Negative -):</strong> Bends the beam into a frowny face curve (tension in top fibers, compression in bottom). Typical in cantilever beams and over supports.<br><br>
                       <strong>Key Tip:</strong> The bending moment peaks where the shear force passes through zero ($V = 0$) or changes sign. This is because $dM/dx = V(x)$.`
            },
            reactions: {
                keywords: ["reaction", "support force", "equilibrium", "moments about A", "moments about B"],
                reply: `⚖️ <strong>Support Reactions</strong> are calculated using the equations of static equilibrium for a 2D body:<br>
                       1. $\\sum F_y = 0$ (Vertical forces balance)<br>
                       2. $\\sum M_z = 0$ (Sum of all rotational moments about any point is zero)<br><br>
                       For Simply Supported or Overhanging beams, we take moments about Support A to find Reaction B ($R_B$), and then subtract to find $R_A$.<br>
                       For Cantilevers, the fixed support provides 100% of vertical resistance ($R_A$) and a clamping moment reaction ($M_A$) that balances the applied loads.`
            },
            deflection: {
                keywords: ["deflection", "slope", "ei", "displacement", "bending curve", "young's modulus"],
                reply: `🌊 <strong>Beam Deflection</strong> is the displacement of the beam axis under load.<br><br>
                       BeamMaster AI solves this analytically using the **Euler-Bernoulli Beam Theory** equation:<br>
                       $$\\frac{d^2y}{dx^2} = \\frac{M(x)}{EI}$$<br>
                       Where:<br>
                       • $y$ = Beam deflection (downward is negative)<br>
                       • $M(x)$ = Bending moment as a function of $x$<br>
                       • $E$ = Young's Modulus of the material (stiffness)<br>
                       • $I$ = Moment of Inertia of the cross-section (geometry)<br><br>
                       <strong>Double Integration Method:</strong> By integrating the curvature diagram twice and applying boundary conditions (deflection = 0 at supports, slope = 0 at fixed clamps), we get the exact elastic deflection curve.`
            },
            contraflexure: {
                keywords: ["contraflexure", "point of contraflexure", "inflection point", "zero moment"],
                reply: `🎯 A <strong>Point of Contraflexure</strong> (or point of inflection) is the location along the beam where the bending moment changes sign (crosses zero).<br><br>
                       <strong>Why it matters:</strong> At this point, the curvature changes from sagging to hogging. In reinforced concrete beam design, this is the region where tension reinforcement switches from the bottom of the beam to the top of the beam.`
            },
            formulas: {
                keywords: ["formula", "equation", "standard cases", "cheatsheet"],
                reply: `📖 <strong>Standard Beam Formula Cheat Sheet:</strong><br><br>
                       <strong>1. Simply Supported (Span L, Center Point Load P):</strong><br>
                       • Max Moment: $M_{\\text{max}} = PL / 4$ (at center)<br>
                       • Max Deflection: $\\delta_{\\text{max}} = PL^3 / (48EI)$<br><br>
                       <strong>2. Simply Supported (Span L, Full UDL w):</strong><br>
                       • Max Moment: $M_{\\text{max}} = wL^2 / 8$ (at center)<br>
                       • Max Deflection: $\\delta_{\\text{max}} = 5wL^4 / (384EI)$<br><br>
                       <strong>3. Cantilever (Length L, End Point Load P):</strong><br>
                       • Max Moment: $M_{\\text{max}} = -PL$ (at fixed end)<br>
                       • Max Deflection: $\\delta_{\\text{max}} = PL^3 / (3EI)$`
            }
        };
    }

    /**
     * Responds to user queries by matching keywords or generating dynamic analysis.
     * @param {string} queryText - The message sent by the user
     * @param {Object} currentBeamState - The active configuration and calculation outputs
     */
    getResponse(queryText, currentBeamState) {
        const text = queryText.toLowerCase().trim();

        // Check for active beam analysis request
        if (text.includes("analyze") || text.includes("explain beam") || text.includes("current beam") || text.includes("explain active")) {
            return this.generateBeamAnalysis(currentBeamState);
        }

        // Match keyword in static database
        for (const key in this.knowledgeBase) {
            const kb = this.knowledgeBase[key];
            if (kb.keywords.some(kw => text.includes(kw))) {
                return kb.reply;
            }
        }

        // Fallback response
        return `🤔 I'm not sure I fully understand. I can help with beam analysis theory (SFD, BMD, reactions, deflections, formulas).<br><br>
                Try asking "What is bending moment?" or click <strong>"Explain Active Beam"</strong> below to review your current setup!`;
    }

    /**
     * Dynamic Beam Analyzer: Reads live calculator outputs and generates structural insights.
     */
    generateBeamAnalysis(state) {
        if (!state || !state.results || !state.results.summary) {
            return `⚠️ <strong>No calculation data found.</strong> Please input beam details and run the calculator first!`;
        }

        const typeMap = {
            simply_supported: "Simply Supported Beam",
            cantilever: "Cantilever Beam",
            fixed: "Fixed-Fixed Beam",
            overhanging: "Overhanging Beam"
        };

        const beamName = typeMap[state.config.type] || "Beam Structure";
        const len = state.config.length;
        const res = state.results;
        const sum = res.summary;
        const rx = res.reactions;

        let html = `🔍 <strong>Active Beam Structure Analysis Report</strong><br><br>`;
        html += `• <strong>System Type:</strong> ${beamName}<br>`;
        html += `• <strong>Span Length:</strong> ${len} m<br>`;
        
        // Supports
        if (state.config.type === 'overhanging') {
            html += `• <strong>Support Positions:</strong> Left support at $x = ${state.config.supports.a}$ m, Right support at $x = ${state.config.supports.b}$ m.<br>`;
        }

        // Reactions
        html += `<br>📊 <strong>Support Reactions:</strong><br>`;
        if (state.config.type === 'cantilever') {
            html += `• Left Support Reaction $R_A$: ${rx.RA.toFixed(2)} kN (Upward)<br>`;
            html += `• Clamping Moment Reaction $M_A$: ${rx.MA.toFixed(2)} kNm (Counter-clockwise)<br>`;
        } else if (state.config.type === 'fixed') {
            html += `• Support A Reaction $R_A$: ${rx.RA.toFixed(2)} kN | Moment $M_A$: ${rx.MA.toFixed(2)} kNm<br>`;
            html += `• Support B Reaction $R_B$: ${rx.RB.toFixed(2)} kN | Moment $M_B$: ${rx.MB.toFixed(2)} kNm<br>`;
        } else {
            html += `• Support A Reaction $R_A$: ${rx.RA.toFixed(2)} kN (at $x = ${state.config.supports?.a || 0}$ m)<br>`;
            html += `• Support B Reaction $R_B$: ${rx.RB.toFixed(2)} kN (at $x = ${state.config.supports?.b || len}$ m)<br>`;
        }

        // Critical Force Values
        html += `<br>⚡ <strong>Critical Internal Forces:</strong><br>`;
        html += `• <strong>Max Shear Force:</strong> ${sum.absMaxSF.toFixed(2)} kN (occurs at $x = ${sum.maxSF_x}$ m)<br>`;
        html += `• <strong>Max Bending Moment:</strong> ${sum.absMaxBM.toFixed(2)} kNm (${sum.maxBM >= 0 ? 'Sagging' : 'Hogging'}, at $x = ${sum.maxBM_x}$ m)<br>`;
        
        // Deflection
        const maxD = Math.max(Math.abs(sum.maxDefl), Math.abs(sum.minDefl));
        html += `• <strong>Peak Deflection:</strong> ${maxD.toFixed(2)} mm (at $x = ${sum.maxDefl_x}$ m)<br>`;

        // Contraflexure
        if (sum.contraflexure && sum.contraflexure.length > 0) {
            html += `• <strong>Points of Contraflexure (M = 0):</strong> $x = ${sum.contraflexure.join(', ')}$ m.<br>`;
        }

        // Engineering Review Recommendations
        html += `<br>🛠️ <strong>Structural Recommendations:</strong><br>`;
        
        let recs = [];
        if (sum.absMaxSF > 50) {
            recs.push(`⚠️ High shear force detected (${sum.absMaxSF.toFixed(1)} kN). If this is a concrete beam, design heavy stirrup reinforcement, especially near $x = ${sum.maxSF_x}$ m where shear stresses peak.`);
        } else {
            recs.push(`✓ Shear forces are relatively moderate. Standard nominal stirrup spacing is likely sufficient.`);
        }

        if (state.config.type === 'cantilever') {
            recs.push(`✓ For this Cantilever, design flexural reinforcement at the <strong>top tension fibers</strong> (hogging zone) near the fixed support (x = 0).`);
        } else if (state.config.type === 'simply_supported') {
            recs.push(`✓ For this Simple Span, design main tensile reinforcing steel bars at the <strong>bottom fibers</strong> (sagging zone) with peak requirement at the center $x = ${sum.maxBM_x}$ m.`);
        } else if (state.config.type === 'fixed' || state.config.type === 'overhanging') {
            recs.push(`✓ Continuous bending moments switch signs. Provide reinforcement at the <strong>top fibers</strong> over supports (hogging zone) and at the <strong>bottom fibers</strong> in the midspan (sagging zone).`);
        }

        if (maxD > (len * 1000 / 250)) {
            recs.push(`⚠️ Deflection exceeds span limit ($L/250 = ${(len * 1000 / 250).toFixed(1)}$ mm). Consider increasing the section size (Moment of Inertia $I$) or raising the concrete grade/material grade to prevent serviceability failure.`);
        } else {
            recs.push(`✓ Deflection limits satisfy standard serviceability criteria ($L/250$ span ratio).`);
        }

        html += recs.map(r => `• ${r}`).join('<br>');

        return html;
    }
}

window.AIAssistant = AIAssistant;
