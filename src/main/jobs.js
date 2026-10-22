const { randomUUID } = require("crypto");
class JobQueue {
  constructor(convert, notify) {
    this.convert = convert;
    this.notify = notify;
    this.jobs = [];
    this.running = false;
  }
  emit(job, extra = {}) {
    this.notify({
      id: job.id,
      inputPath: job.inputPath,
      target: job.target,
      state: job.state,
      ...extra,
    });
  }
  add(paths, target, options, owner) {
    const jobs = paths.map((inputPath) => ({
      id: randomUUID(),
      inputPath,
      target,
      options,
      owner,
      state: "queued",
      controller: new AbortController(),
    }));
    this.jobs.push(...jobs);
    jobs.forEach((j) => this.emit(j));
    setImmediate(() => this.drain());
    return jobs.map((j) => j.id);
  }
  cancel(owner) {
    for (const j of this.jobs)
      if (j.owner === owner && ["queued", "running"].includes(j.state)) {
        j.controller.abort();
        if (j.state === "queued") {
          j.state = "cancelled";
          this.emit(j);
        }
      }
  }
  async drain() {
    if (this.running) return;
    this.running = true;
    try {
      for (let j; (j = this.jobs.find((j) => j.state === "queued")); ) {
        j.state = "running";
        this.emit(j);
        try {
          const result = await this.convert(j.inputPath, j.target, {
            ...j.options,
            signal: j.controller.signal,
            onProgress: (p) => this.emit(j, p),
          });
          j.state = "done";
          this.emit(j, { result });
        } catch (e) {
          j.state = j.controller.signal.aborted ? "cancelled" : "error";
          this.emit(j, {
            error: j.state === "cancelled" ? "Conversão cancelada." : e.message,
          });
        }
      }
    } finally {
      this.jobs = this.jobs.filter((j) => j.state === "queued");
      this.running = false;
    }
  }
}
module.exports = { JobQueue };
