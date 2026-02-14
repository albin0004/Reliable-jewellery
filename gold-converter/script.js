document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const inputA = document.getElementById('input-a'); // Manual / Reference (Row 2, Col A)
    const inputB = document.getElementById('input-b'); // Pure Gold (Row 2, Col B)
    const inputC = document.getElementById('input-c'); // 18K Gold (Row 2, Col C)
    const refFactorInput = document.getElementById('ref-factor'); // Purity Factor (A1)
    const constantCInput = document.getElementById('constant-c'); // Constant (C1)
    const labelC = document.getElementById('label-c'); // Label for Column C

    // Helper to parse float safely
    const parseVal = (val) => {
        const parsed = parseFloat(val);
        return isNaN(parsed) ? 0 : parsed;
    };

    // Helper to format to 2 decimals
    const formatVal = (val) => {
        return val.toFixed(2);
    };

    // Helper to get dynamic constant for C
    const getConstantC = () => {
        return parseVal(constantCInput.value);
    };

    // Update Label C based on constant
    const updateLabelC = () => {
        const val = getConstantC();
        // Use a small epsilon for float comparison if needed, or string comparison if exact input matters.
        // Assuming strict 0.750 requirement.
        if (Math.abs(val - 0.750) < 0.0001) {
            labelC.textContent = '18K Gold';
        } else {
            labelC.textContent = 'Gold';
        }
    };

    // Calculation Logic

    function updateFromA() {
        const valA = parseVal(inputA.value);
        const factorA = parseVal(refFactorInput.value);
        const constantC = getConstantC();

        if (valA === 0 || factorA === 0) {
            inputB.value = '';
            inputC.value = '';
            return;
        }

        // B2 = A1 * A2
        const valB = factorA * valA;
        inputB.value = formatVal(valB);

        // C2 = B2 / constantC
        if (constantC !== 0) {
            const valC = valB / constantC;
            inputC.value = formatVal(valC);
        } else {
            inputC.value = 'Err';
        }
    }

    function updateFromB() {
        const valB = parseVal(inputB.value);
        const factorA = parseVal(refFactorInput.value);
        const constantC = getConstantC();

        if (valB === 0) {
            inputA.value = '';
            inputC.value = '';
            return;
        }

        // A2 = B2 / A1
        // Avoid division by zero
        if (factorA !== 0) {
            const valA = valB / factorA;
            inputA.value = formatVal(valA);
        } else {
            inputA.value = 'Err';
        }

        // C2 = B2 / constantC
        if (constantC !== 0) {
            const valC = valB / constantC;
            inputC.value = formatVal(valC);
        } else {
            inputC.value = 'Err';
        }
    }

    function updateFromC() {
        const valC = parseVal(inputC.value);
        const factorA = parseVal(refFactorInput.value);
        const constantC = getConstantC();

        if (valC === 0) {
            inputA.value = '';
            inputB.value = '';
            return;
        }

        // B2 = C2 * constantC
        const valB = valC * constantC;
        inputB.value = formatVal(valB);

        // A2 = B2 / A1
        if (factorA !== 0) {
            const valA = valB / factorA;
            inputA.value = formatVal(valA);
        } else {
            inputA.value = 'Err';
        }
    }

    // Event Listeners
    inputA.addEventListener('input', updateFromA);
    inputB.addEventListener('input', updateFromB);
    inputC.addEventListener('input', updateFromC);

    // If Reference Factor changes, update based on who was last active or default to updating from A if A has value
    refFactorInput.addEventListener('input', () => {
        if (inputA.value) updateFromA();
        else if (inputB.value) updateFromB();
        else if (inputC.value) updateFromC();
    });

    // If Constant C changes
    constantCInput.addEventListener('input', () => {
        updateLabelC();
        if (inputA.value) updateFromA();
        else if (inputB.value) updateFromB();
        else if (inputC.value) updateFromC();
    });

    // Initial check
    updateLabelC();
});
