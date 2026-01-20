
// Boundary Test Cases for Operation Isolation in Annotation Mode
import OperarPenetration from '../smart_screenik/Operar_Penetration.js';

const runTests = async () => {
  console.log('Running Isolation Boundary Tests...');
  let failures = 0;
  const assert = (cond, msg) => {
    if (!cond) {
      console.error(`[FAIL] ${msg}`);
      if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.sendToMain) {
        window.electronAPI.sendToMain('tests:log', `[FAIL] ${msg}`);
      }
      failures++;
    } else {
      console.log(`[PASS] ${msg}`);
      if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.sendToMain) {
        window.electronAPI.sendToMain('tests:log', `[PASS] ${msg}`);
      }
    }
  };

  // Mock Dependencies
  const mockMain = (ch, payload) => {
    // console.log(`IPC: ${ch}`, payload);
    if (ch === 'overlay:set-ignore-mouse') {
      lastIgnore = payload;
    }
  };
  let lastIgnore = null;

  // 1. Test Pen Mode Isolation (Drawing)
  {
    console.log('--- Test 1: Pen Mode Isolation ---');
    const op = new OperarPenetration({
      appModes: { WHITEBOARD: 'whiteboard', ANNOTATION: 'annotation' },
      getAppMode: () => 'annotation',
      isPointerActive: () => false, // Pen is active
      sendToMain: mockMain
    });

    // Simulate input
    op.applyWindowInteractivityNow();
    
    assert(lastIgnore && lastIgnore.ignore === false, 'Pen Mode should BLOCK input (ignore: false)');
    assert(lastIgnore && lastIgnore.forward === false, 'Pen Mode should NOT forward events');
  }

  // 2. Test Pointer Mode Penetration (Desktop Interaction)
  {
    console.log('--- Test 2: Pointer Mode Penetration ---');
    const op = new OperarPenetration({
      appModes: { WHITEBOARD: 'whiteboard', ANNOTATION: 'annotation' },
      getAppMode: () => 'annotation',
      isPointerActive: () => true, // Pointer tool active
      sendToMain: mockMain
    });

    op.applyWindowInteractivityNow();
    
    // Should default to penetrate
    assert(lastIgnore && lastIgnore.ignore === true, 'Pointer Mode should PENETRATE input (ignore: true)');
    assert(lastIgnore && lastIgnore.forward === true, 'Pointer Mode should FORWARD events');
  }

  // 3. Test Rapid Switching (Boundary: Fast Toggle)
  {
    console.log('--- Test 3: Rapid Switching Boundary ---');
    let pointerActive = true;
    const op = new OperarPenetration({
      appModes: { WHITEBOARD: 'whiteboard', ANNOTATION: 'annotation' },
      getAppMode: () => 'annotation',
      isPointerActive: () => pointerActive,
      sendToMain: mockMain
    });

    // Toggle rapidly
    for (let i = 0; i < 10; i++) {
      pointerActive = !pointerActive;
      op.applyWindowInteractivityNow();
      if (pointerActive) {
        assert(lastIgnore.ignore === true, `Cycle ${i}: Pointer Active -> Penetrate`);
      } else {
        assert(lastIgnore.ignore === false, `Cycle ${i}: Pen Active -> Block`);
      }
    }
  }

  // 4. Test Touch Block Stability (Boundary: "Recent Touch" Logic)
  {
    console.log('--- Test 4: Touch Block Stability in Annotation ---');
    const op = new OperarPenetration({
      appModes: { WHITEBOARD: 'whiteboard', ANNOTATION: 'annotation' },
      getAppMode: () => 'annotation',
      isPointerActive: () => true, // Pointer mode
      sendToMain: mockMain
    });

    // Simulate recent touch activity
    op.recordPointerInput('touch');
    op.markTouchAction();
    
    // In Annotation mode, recent touch should NOT block desktop interaction
    op.applyWindowInteractivityNow();
    
    assert(lastIgnore.ignore === true, 'Recent touch in Annotation Mode (Pointer) should NOT block penetration');
  }

  // 5. Test Touch Move Hit Testing (Touch Penetration)
  {
    console.log('--- Test 5: Touch Move Hit Testing ---');
    const op = new OperarPenetration({
      appModes: { WHITEBOARD: 'whiteboard', ANNOTATION: 'annotation' },
      getAppMode: () => 'annotation',
      isPointerActive: () => true,
      sendToMain: mockMain
    });

    // Mock rects
    op.collectInteractiveRects = () => [{ left: 0, top: 0, width: 100, height: 100 }];

    // Touch INSIDE rect
    op.handleTouchMove({
      touches: [{ clientX: 50, clientY: 50 }]
    });
    assert(lastIgnore && lastIgnore.ignore === false, 'Touch inside rect should BLOCK input');

    // Reset throttle
    op.lastTouchCheckAt = 0;

    // Touch OUTSIDE rect
    op.handleTouchMove({
      touches: [{ clientX: 200, clientY: 200 }]
    });
    // Should release block
    assert(lastIgnore && lastIgnore.ignore === true, 'Touch outside rect should PENETRATE input');
  }

  if (failures === 0) {
    console.log('All Boundary Tests Passed.');
    return true;
  } else {
    console.error(`${failures} Boundary Tests Failed.`);
    throw new Error(`${failures} Boundary Tests Failed`);
  }
};

export default runTests;

// Run if executed directly (in a real env this would be via test runner)
if (typeof window !== 'undefined' && !window.__IS_TEST_RUNNER__) {
  runTests().catch(e => console.error(e));
}
