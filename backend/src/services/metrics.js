class MetricsTracker {
  constructor() {
    this.requests = 0;
    this.errors = 0;
  }

  track(status) {
    this.requests++;
    if (status >= 400) this.errors++;
  }

  getSnapshot() {
    return {
      totalRequests: this.requests,
      errorCount: this.errors,
      errorRate: this.requests ? (this.errors / this.requests).toFixed(4) : 0,
    };
  }
}

export const metrics = new MetricsTracker();
