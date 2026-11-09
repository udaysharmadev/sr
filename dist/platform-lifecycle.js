// CrazyGames HTML5 v3 lifecycle: https://docs.crazygames.com/sdk/game/
export function platformLifecycle(sdk) {
  let loading = false, playing = false;
  const report = (method) => {
    try { sdk?.game?.[method]?.()?.catch?.(() => {}); } catch {}
  };
  return {
    loading(value) {
      if (loading === Boolean(value)) return;
      loading = Boolean(value);
      report(loading ? "loadingStart" : "loadingStop");
    },
    gameplay(value) {
      if (playing === Boolean(value)) return;
      playing = Boolean(value);
      report(playing ? "gameplayStart" : "gameplayStop");
    },
  };
}
