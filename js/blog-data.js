const BLOG_POSTS = [
    {
        id: "sfd-bmd-fundamentals",
        title: "Mastering Shear Force & Bending Moment Diagrams",
        category: "Structural Analysis",
        summary: "An intuitive guide to understanding how external loads transform into internal forces, and how to draw diagrams accurately without getting lost in sign conventions.",
        author: "Dr. Elena Vance, PE",
        date: "May 15, 2026",
        readTime: "8 min read",
        content: `
            <p>For any civil or structural engineer, Shear Force Diagrams (SFD) and Bending Moment Diagrams (BMD) are the absolute foundation of design. They represent how a beam resists external loading by generating internal shear stress and flexural stresses.</p>
            <h3>The Core Concept</h3>
            <p>When external loads (like point loads, distributed loads, or moments) act on a structural element, the element responds with support reactions to maintain static equilibrium. At any internal cross-section along the beam, there must be internal forces balancing the external segments on either side of that cut. These internal effects are:</p>
            <ul>
                <li><strong>Shear Force (V):</strong> The sum of all vertical forces acting to the left (or right) of the section.</li>
                <li><strong>Bending Moment (M):</strong> The sum of all moments of the forces to the left (or right) of the section about the cut.</li>
            </ul>
            <blockquote>
                "A shear force diagram plots the vertical internal forces along the length of a member, while a bending moment diagram plots the internal moment that tends to bend the member."
            </blockquote>
            <h3>Sign Conventions: The Classic Sagging vs. Hogging</h3>
            <p>One of the biggest hurdles for engineering students is sign convention. BeamMaster AI uses the standard structural convention:</p>
            <ul>
                <li><strong>Shear Force:</strong> Positive (+) if the forces to the left of the section push the left side upwards relative to the right side.</li>
                <li><strong>Bending Moment (Sagging):</strong> Positive (+) if the bending tends to bend the beam in a "U" shape (concave upwards). This puts tension in the bottom fibers and compression in the top fibers.</li>
                <li><strong>Bending Moment (Hogging):</strong> Negative (-) if the bending tends to bend the beam in an upside-down "U" shape (convex upwards), putting tension in the top fibers.</li>
            </ul>
            <h3>The Mathematical Relationships</h3>
            <p>There are two beautiful differential relationships that link load ($w$), shear force ($V$), and bending moment ($M$):</p>
            <ol>
                <li><strong>Rate of change of Shear Force is equal to load intensity:</strong> <br><code>dV/dx = -w(x)</code></li>
                <li><strong>Rate of change of Bending Moment is equal to Shear Force:</strong> <br><code>dM/dx = V(x)</code></li>
            </ol>
            <p>These relationships imply that the shear force diagram is the integral of the load curve, and the bending moment diagram is the integral of the shear force diagram. Consequently, a point load causes a vertical step in the SFD, and a UDL causes a linear slope in the SFD and a quadratic curve (parabola) in the BMD!</p>
        `
    },
    {
        id: "rcc-beam-design-guide",
        title: "Reinforced Concrete Beam Design: Limit State Method",
        category: "RCC Design",
        summary: "A practical walkthrough of how SFD and BMD results are translated into concrete cross-section dimensions and longitudinal steel reinforcement ratios.",
        author: "Ir. Thomas Cole, SE",
        date: "May 22, 2026",
        readTime: "12 min read",
        content: `
            <p>Once you run your structural analysis on BeamMaster AI and obtain the maximum shear force ($V_u$) and bending moment ($M_u$), the next step is RCC design. This article focuses on design principles using the Limit State Method (LSM) as per international standards like ACI 318 and IS 456.</p>
            <h3>Step 1: Size the Beam Section</h3>
            <p>Beams are sized based on architectural limits, deflection requirements, and flexural demand. A common rule of thumb for depth ($D$) is <code>L/10 to L/12</code> of the span length. The width ($b$) is usually taken as <code>0.4 to 0.6</code> of the depth.</p>
            <h3>Step 2: Flexural Design (Tension Reinforcement)</h3>
            <p>Concrete is extremely strong in compression but weak in tension. Steel rebar is placed in the tension zone (the bottom for sagging moments in simple spans, or the top for hogging moments over supports in continuous/cantilever beams).</p>
            <p>The required area of steel ($A_{st}$) is determined by balancing the compression block of concrete with the tensile force of steel:</p>
            <p><code>M_u = 0.87 × f_y × A_st × d × (1 - (A_st × f_y) / (b × d × f_ck))</code></p>
            <p>Where:</p>
            <ul>
                <li><strong>f_y:</strong> Yield strength of steel rebar (e.g., 415 or 500 MPa)</li>
                <li><strong>f_ck:</strong> Characteristic compressive strength of concrete (e.g., 20 or 25 MPa)</li>
                <li><strong>d:</strong> Effective depth (overall depth minus concrete cover and half rebar diameter)</li>
            </ul>
            <h3>Step 3: Shear Design (Stirrups)</h3>
            <p>Concrete beam failures due to shear are brittle and catastrophic, which is why shear design is critical. The design shear force is obtained from the SFD.</p>
            <p>The nominal shear stress is computed: <code>τ_v = V_u / (b × d)</code>. This is compared to the design shear strength of concrete <code>τ_c</code> (which depends on the concrete grade and the percentage of tensile steel reinforcement).</p>
            <ul>
                <li>If <code>τ_v &lt; τ_c</code>: Provide nominal minimum shear stirrups.</li>
                <li>If <code>τ_v &gt; τ_c</code>: Design shear reinforcement (stirrups spacing) to carry the excess shear: <code>V_us = V_u - τ_c × b × d</code>.</li>
                <li>If <code>τ_v &gt; τ_c,max</code>: Redesign the section by increasing the width or depth of the beam.</li>
            </ul>
        `
    },
    {
        id: "steel-design-flexural-members",
        title: "Design of Structural Steel Beams: Lateral Torsional Buckling",
        category: "Steel Design",
        summary: "Understanding the failure modes of structural steel I-beams, focusing on plastic moments, compact sections, and lateral-torsional buckling controls.",
        author: "Sarah Jenkins, CEng MICE",
        date: "May 28, 2026",
        readTime: "10 min read",
        content: `
            <p>Structural steel beams, typically hot-rolled I-sections (such as Universal Beams, W-shapes, or IPE-sections), offer high strength-to-weight ratios. However, unlike concrete beams, their primary failure mode is often related to elastic instability rather than raw material crushing.</p>
            <h3>Classification of Steel Sections</h3>
            <p>Steel sections must first be classified based on width-to-thickness ratios of their flanges and webs to check for local buckling:</p>
            <ul>
                <li><strong>Plastic/Compact Sections:</strong> Can achieve full plastic moment capacity ($M_p$) and sustain rotation before local buckling occurs.</li>
                <li><strong>Non-Compact Sections:</strong> Can achieve yield moment capacity ($M_y$) in outer fibers, but local buckling prevents achieving full plasticity.</li>
                <li><strong>Slender Sections:</strong> Local buckling occurs elastically before yield stress is reached. Avoided in standard beam designs.</li>
            </ul>
            <h3>Lateral Torsional Buckling (LTB)</h3>
            <p>When an I-beam is subjected to bending, the top flange is placed in compression. Under high loads, this compression flange acts like a column under axial load and wants to buckle sideways. Because the bottom flange is in tension and stays straight, the entire cross-section twists. This phenomenon is called <strong>Lateral Torsional Buckling</strong>.</p>
            <blockquote>
                "If a steel beam is not laterally supported along its length, it will buckle sideways and twist at a capacity lower than its in-plane bending capacity."
            </blockquote>
            <h3>Mitigating LTB</h3>
            <p>Engineers prevent LTB using two main strategies:</p>
            <ol>
                <li><strong>Continuous Lateral Bracing:</strong> Connecting the compression flange to a concrete floor slab or decking. In this case, the beam is classified as "laterally supported", and its capacity is simply the plastic moment capacity: <code>M_n = M_p = F_y × Z_p</code> (where $Z_p$ is the plastic section modulus).</li>
                <li><strong>Discrete Bracing:</strong> Providing intermediate cross-bracing or purlins at calculated spacings ($L_b$). The design capacity is calculated based on the unbraced length and the lateral-torsional buckling equations specified in AISC 360 or Eurocode 3.</li>
            </ol>
        `
    }
];

window.BLOG_POSTS = BLOG_POSTS;
