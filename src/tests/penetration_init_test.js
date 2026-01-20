import OperarPenetration from '../smart_screenik/Operar_Penetration.js';

const runTests = async () => {
  let failures = 0;
  const log = (ok, msg) => {
    try{
      if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.sendToMain) {
        window.electronAPI.sendToMain('tests:log', `${ok ? '[PASS]' : '[FAIL]'} ${msg}`);
      }
    }catch(e){}
  };
  const assert = (cond, msg) => {
    if (!cond) { failures++; log(false, msg); } else { log(true, msg); }
  };

  {
    let lastIgnore = null;
    const inst = new OperarPenetration({
      appModes: { WHITEBOARD: 'whiteboard', ANNOTATION: 'annotation' },
      getAppMode: () => 'annotation',
      isPointerActive: () => true,
      sendToMain: (ch, payload) => {
        if (ch === 'overlay:set-ignore-mouse') lastIgnore = payload;
      }
    });
    inst.isTouchEnvironment = () => true;
    inst.bindGlobalListeners();
    assert(lastIgnore && lastIgnore.ignore === true, 'init penetration sets ignore true immediately');
    assert(lastIgnore && lastIgnore.forward === true, 'init penetration sets forward true immediately');
  }

  if (failures === 0) return true;
  throw new Error(`${failures} failures`);
};

export default runTests;
