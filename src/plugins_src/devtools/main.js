
const DEVTOOLS_HTML_PATH = 'ui.html';

Mod.on('init', async () => {
  Mod.registerTool({
    id: 'toggle',
    title: 'Developer Tools',
    iconSvg: await Mod.readAsset('lanstart.devtools', 'icon.svg', 'utf8')
  });
});

Mod.on('tool', async (evt) => {
  if (evt.toolId === 'toggle') {
    const html = await Mod.readAsset('lanstart.devtools', DEVTOOLS_HTML_PATH, 'utf8');
    Mod.showOverlay({ html });
  }
});

Mod.on('ui', async (evt) => {
  if (evt.action === 'devtools:eval') {
    const code = evt.code;
    const reqId = evt.reqId;
    if (!code) return;
    
    // Call the newly added Mod.devtools.eval API
    // Note: The result comes back via a separate message channel in the worker shim
    // But our worker shim extension in mod.js wrapped it in a Promise.
    // So here we can just await it if the worker API was exposed properly.
    // Wait, in my modification to mod.js, I exposed Mod.devtools.eval in the WORKER SCOPE (the `boot` string).
    
    try {
      const res = await Mod.devtools.eval(code);
      Mod.publish('devtools:eval-result', { reqId, result: res });
    } catch (e) {
      Mod.publish('devtools:eval-result', { reqId, error: e.message });
    }
  }
  
  if (evt.action === 'devtools:inspect') {
    const selector = evt.selector;
    if (selector) {
      Mod.devtools.inspect(selector);
    }
  }
});
