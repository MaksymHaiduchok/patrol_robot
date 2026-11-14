const MIN_ODOMETER_STEP = 2;
const MIN_STEER_STEP = 3;

export type PathPoint = {
  odometer: number;
  steerAngle: number;
};

export class PathRecorder {
  private points: PathPoint[] = [];
  private recording = false;
  private homeSet = false;

  get hasHome(): boolean {
    return this.homeSet;
  }

  begin(point: PathPoint): void {
    this.points = [point];
    this.recording = true;
    this.homeSet = true;
  }

  sample(point: PathPoint): void {
    if (!this.recording) {
      return;
    }
    const last = this.points[this.points.length - 1];
    if (
      Math.abs(point.odometer - last.odometer) >= MIN_ODOMETER_STEP ||
      Math.abs(point.steerAngle - last.steerAngle) >= MIN_STEER_STEP
    ) {
      this.points.push(point);
    }
  }

  take(current: PathPoint): PathPoint[] {
    this.sample(current);
    this.recording = false;
    return [...this.points];
  }

  resume(points: PathPoint[]): void {
    this.points = points;
    this.recording = this.homeSet;
  }

  clear(): void {
    this.points = [];
    this.recording = false;
    this.homeSet = false;
  }
}
