import { Injectable } from '@nestjs/common';

type BirdState = 'idle' | 'sync' | 'thinking' | 'done' | 'error';

const FRAMES: Record<BirdState, string[]> = {
  idle: ['  ,_,', ' (o,o)', '/)   )', ' " " " '],
  sync: ['  ,_,', ' (O,o)', '/) ) )', ' " " " '],
  thinking: ['  ,_,', ' (o,O)', '/)  )~', ' " " " '],
  done: ['  ,_,', ' (^,^)', '/)   )', ' " " " '],
  error: ['  ,_,', ' (x,x)', '/)   )', ' " " " '],
};

@Injectable()
export class BirdUiService {
  private timer: NodeJS.Timeout | null = null;
  private state: BirdState = 'idle';
  private tick = 0;

  start(initialState: BirdState, label = 'snd'): void {
    this.state = initialState;
    this.stop();
    this.timer = setInterval(() => {
      this.render(label);
    }, 280);
  }

  setState(state: BirdState): void {
    this.state = state;
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  printLine(line: string): void {
    process.stdout.write(`\r\x1b[K${line}\n`);
  }

  private render(label: string): void {
    const frames = FRAMES[this.state];
    const frame = frames[this.tick % frames.length] ?? frames[0];
    this.tick += 1;

    process.stdout.write(`\r\x1b[K${frame} [${this.state}] ${label}`);
  }
}
