const TUTORIALS = [
    {
        id: "simply-supported-center-load",
        title: "Simply Supported Beam with Center Point Load",
        topic: "Point Loads",
        difficulty: "Beginner",
        summary: "The most classic structural problem: a simply supported span under a single concentrated load in the exact center.",
        beamType: "simply_supported",
        length: 6,
        supports: { a: 0, b: 6 },
        E: 200,
        I: 5000,
        loads: [
            { type: "point", position: 3, magnitude: 20 }
        ],
        theory: `
            <p>A simply supported beam has pinned/hinged supports at its ends. Under a single center point load $P$, the structure is perfectly symmetric.</p>
            <h4>Static Equilibrium Equations:</h4>
            <ul>
                <li>Total downward force $= P = 20$ kN.</li>
                <li>Due to symmetry, the reactions at both ends must be equal: <br>
                    <code>R_A = R_B = P / 2 = 20 / 2 = 10 kN</code>.
                </li>
            </ul>
            <h4>Shear Force Diagram (SFD):</h4>
            <ul>
                <li>From $x = 0$ to $x = 3$ m: $V(x) = R_A = +10$ kN.</li>
                <li>At $x = 3$ m, the point load pushes downwards: $V(x)$ drops by $20$ kN, changing from $+10$ kN to $-10$ kN.</li>
                <li>From $x = 3$ to $x = 6$ m: $V(x) = -10$ kN.</li>
            </ul>
            <h4>Bending Moment Diagram (BMD):</h4>
            <ul>
                <li>Bending Moment is linear, starting at 0 at the supports and peaking under the load.</li>
                <li>At any point $x$ in the left half ($x \le L/2$): $M(x) = R_A \cdot x = 10x$.</li>
                <li>At the center ($x = 3$ m): <br>
                    <code>M_max = P · L / 4 = 20 · 6 / 4 = 30 kNm</code>.
                </li>
            </ul>
        `
    },
    {
        id: "cantilever-udl-point-load",
        title: "Cantilever Beam with Point Load & Full UDL",
        topic: "UDL & Point Loads",
        difficulty: "Intermediate",
        summary: "A cantilever beam fixed at the left end, subjected to a uniformly distributed load along its length and a concentrated point load at the free end.",
        beamType: "cantilever",
        length: 4,
        supports: { a: 0, b: 0 },
        E: 200,
        I: 5000,
        loads: [
            { type: "udl", start: 0, end: 4, magnitude: 5 },
            { type: "point", position: 4, magnitude: 15 }
        ],
        theory: `
            <p>A cantilever beam is fixed at one end and entirely unsupported (free) at the other end. All support reactions (vertical force and moment) are located at the fixed end.</p>
            <h4>Support Reactions (at x = 0):</h4>
            <ul>
                <li>Vertical force reaction ($R_A$): Sum of all vertical forces: <br>
                    <code>R_A = P + w · L = 15 kN + (5 kN/m · 4 m) = 15 + 20 = 35 kN</code>.
                </li>
                <li>Moment reaction ($M_A$): The clamping moment that resists clockwise rotation: <br>
                    <code>M_A = P · L + w · L · (L / 2) = 15 · 4 + 5 · 4 · 2 = 60 + 40 = 100 kNm</code> (Counter-clockwise).
                </li>
            </ul>
            <h4>Shear Force Diagram (SFD):</h4>
            <ul>
                <li>At $x = 0^+$, $V = R_A = +35$ kN.</li>
                <li>The shear force decreases linearly along the span due to the UDL: $V(x) = R_A - w \cdot x = 35 - 5x$.</li>
                <li>Just before the free end ($x = 4^-$ m): $V = 35 - 20 = 15$ kN, which is exactly balanced by the $15$ kN point load at the end.</li>
            </ul>
            <h4>Bending Moment Diagram (BMD):</h4>
            <ul>
                <li>Since tension is in the top fibers of the cantilever, the bending moment is negative (hogging) everywhere.</li>
                <li>At $x = 0$ (fixed end): $M = -M_A = -100$ kNm.</li>
                <li> Bending Moment follows a quadratic curve: <br>
                    <code>M(x) = - [ P · (L - x) + w · (L - x)² / 2 ]</code>.
                </li>
                <li>At $x = 4$ m (free end): $M = 0$.</li>
            </ul>
        `
    },
    {
        id: "fixed-beam-full-udl",
        title: "Fixed Beam under Full Uniformly Distributed Load",
        topic: "Indeterminate Structures",
        difficulty: "Advanced",
        summary: "A classical statically indeterminate problem. Bending moments are reduced at the center but high at the fixed supports.",
        beamType: "fixed",
        length: 8,
        supports: { a: 0, b: 8 },
        E: 200,
        I: 5000,
        loads: [
            { type: "udl", start: 0, end: 8, magnitude: 10 }
        ],
        theory: `
            <p>A fixed beam is clamped at both ends, preventing slope and translation. This introduces redundant reactions which must be solved using compatibility of deflections.</p>
            <h4>Support Reactions:</h4>
            <ul>
                <li>Total load $= w \cdot L = 10$ kN/m $\cdot 8$ m $= 80$ kN.</li>
                <li>Due to symmetry, vertical reactions are equal: <br>
                    <code>R_A = R_B = w · L / 2 = 80 / 2 = 40 kN</code>.
                </li>
                <li>Fixed-End Moments ($M_A$ and $M_B$): <br>
                    <code>M_A = M_B = w · L² / 12 = (10 · 8²) / 12 = 640 / 12 = 53.33 kNm</code>.
                </li>
            </ul>
            <h4>Bending Moment Profile:</h4>
            <ul>
                <li>Bending Moment at supports (hogging): $M(0) = M(L) = -53.33$ kNm.</li>
                <li>Bending Moment at center (sagging): <br>
                    <code>M_center = w · L² / 24 = (10 · 8²) / 24 = 26.67 kNm</code>.
                </li>
                <li>Notice that fixing the ends reduces the maximum span moment from $wL^2/8 = 80$ kNm (for simply supported) to $26.67$ kNm, but introduces negative moments of $-53.33$ kNm at the ends.</li>
            </ul>
        `
    },
    {
        id: "overhanging-double-ends",
        title: "Double Overhanging Beam with Concentrated Loads",
        topic: "Overhanging Spans",
        difficulty: "Intermediate",
        summary: "A beam resting on two supports not at the ends, creating overhangs on both sides. Analyzed with point loads at the edges.",
        beamType: "overhanging",
        length: 10,
        supports: { a: 2, b: 8 },
        E: 200,
        I: 5000,
        loads: [
            { type: "point", position: 0, magnitude: 10 },
            { type: "point", position: 5, magnitude: 30 },
            { type: "point", position: 10, magnitude: 10 }
        ],
        theory: `
            <p>An overhanging beam extends beyond its support points. This creates sagging moments in the main span and hogging moments over the support points.</p>
            <h4>Support Reactions (at x = 2 and x = 8):</h4>
            <ul>
                <li>Due to symmetry, the reactions at support A (at $x=2$) and support B (at $x=8$) must be equal.</li>
                <li>Total vertical load $= 10 + 30 + 10 = 50$ kN.</li>
                <li>Therefore: <br>
                    <code>R_A = R_B = 50 / 2 = 25 kN</code>.
                </li>
            </ul>
            <h4>Shear Force Diagram (SFD):</h4>
            <ul>
                <li>From $x=0$ to $x=2^-$: $V = -10$ kN.</li>
                <li>At $x=2$, support reaction pushes up: $V$ goes from $-10$ to $+15$ kN.</li>
                <li>From $x=2$ to $x=5^-$: $V = +15$ kN.</li>
                <li>At $x=5$, center load pushes down: $V$ drops by $30$ kN, going from $+15$ to $-15$ kN.</li>
                <li>From $x=5$ to $x=8^-$: $V = -15$ kN.</li>
                <li>At $x=8$, support reaction pushes up: $V$ goes from $-15$ to $+10$ kN.</li>
                <li>From $x=8$ to $x=10$: $V = +10$ kN.</li>
            </ul>
            <h4>Bending Moment Diagram (BMD):</h4>
            <ul>
                <li>At the overhang tips ($x=0$ and $x=10$): $M = 0$.</li>
                <li>At supports (hogging): <br>
                    <code>M(2) = M(8) = -P_overhang · L_overhang = -10 kN · 2 m = -20 kNm</code>.
                </li>
                <li>At the center ($x=5$): <br>
                    <code>M(5) = R_A · (5 - 2) - P_left · 5 = 25 · 3 - 10 · 5 = 75 - 50 = +25 kNm</code> (Sagging).
                </li>
            </ul>
        `
    }
];

window.TUTORIALS = TUTORIALS;
