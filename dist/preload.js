// Percentages count completed real preparation stages, never elapsed time.
export async function runPreload(stages, progress) {
  progress(0, stages[0]?.label || "Preparing arena");
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    progress(Math.round(i / stages.length * 100), stage.label);
    await stage.run();
    progress(Math.round((i + 1) / stages.length * 100), stage.label);
  }
}

