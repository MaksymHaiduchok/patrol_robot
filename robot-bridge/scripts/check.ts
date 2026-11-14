import { createInterface } from "node:readline/promises";
import { Car, type MotorReadings } from "../src/car.js";
import { loadConfig, type SteerSide } from "../src/config.js";
import { hideSteps } from "../src/hide.js";
import { log, sleep } from "../src/log.js";

const CONNECT_TIMEOUT_MS = 30000;
const SETTLE_MS = 400;
const STEER_WAIT_MS = 1000;
const BASE_POWER = 30;
const BASE_MS = 1000;
const POWER_LEVELS = [20, 40, 60, 80, 100];

type Step = {
  title: string;
  expect: string;
  run: () => Promise<void>;
};

const config = loadConfig();
const car = new Car(config);
const input = createInterface({ input: process.stdin, output: process.stdout });

const waitForHub = async (): Promise<void> => {
  const startedAt = Date.now();
  while (car.status === "offline") {
    if (Date.now() - startedAt > CONNECT_TIMEOUT_MS) {
      throw new Error("Хаб не підключився за 30 с");
    }
    await sleep(200);
  }
};

const steerTo = async (side: SteerSide | null): Promise<void> => {
  car.steer(side);
  await sleep(STEER_WAIT_MS);
};

const driveFor = async (power: number, ms: number, side: SteerSide | null = null): Promise<void> => {
  car.steer(side);
  car.drive(power);
  await sleep(ms);
  car.stop();
  await sleep(SETTLE_MS);
};

const formatDelta = (before: MotorReadings, after: MotorReadings, ms: number): string => {
  const drive = after.drive.map(({ port, degrees }) => {
    const delta = degrees - (before.drive.find((item) => item.port === port)?.degrees ?? 0);
    const perSecond = Math.round((delta / ms) * 1000);
    return `${port}: ${delta > 0 ? "+" : ""}${delta}° (${perSecond}°/с)`;
  });
  const steer = after.steer === null ? "немає даних" : `${after.steer}°`;
  return `хід ${drive.join(", ")} | кермо зараз ${steer}`;
};

const buildSteps = (): Step[] => [
  {
    title: `Кермо вліво на ${config.steerLimitPercent}% вивороту`,
    expect: `передні колеса повертають ЛІВОРУЧ майже до упору, кермо ≈ -${car.steerLimit ?? "?"}°`,
    run: () => steerTo("left"),
  },
  {
    title: `Кермо вправо на ${config.steerLimitPercent}% вивороту`,
    expect: `передні колеса повертають ПРАВОРУЧ майже до упору, кермо ≈ +${car.steerLimit ?? "?"}°`,
    run: () => steerTo("right"),
  },
  {
    title: "Кермо прямо",
    expect: "колеса стоять прямо, кермо ≈ 0°",
    run: () => steerTo(null),
  },
  {
    title: `Вперед ${BASE_POWER}% на ${BASE_MS} мс`,
    expect: `машина їде ВПЕРЕД, у всіх ходових портів градуси з плюсом`,
    run: () => driveFor(BASE_POWER, BASE_MS),
  },
  {
    title: `Назад ${BASE_POWER}% на ${BASE_MS} мс`,
    expect: `машина їде НАЗАД, у всіх ходових портів градуси з мінусом`,
    run: () => driveFor(-BASE_POWER, BASE_MS),
  },
  {
    title: `Поворот вліво з ходом вперед ${BASE_POWER}% на ${BASE_MS} мс`,
    expect: "машина їде вперед і завертає ліворуч, потім кермо прямо",
    run: () => driveFor(BASE_POWER, BASE_MS, "left"),
  },
  {
    title: `Поворот вправо з ходом вперед ${BASE_POWER}% на ${BASE_MS} мс`,
    expect: "машина їде вперед і завертає праворуч, потім кермо прямо",
    run: () => driveFor(BASE_POWER, BASE_MS, "right"),
  },
  ...POWER_LEVELS.map((power) => ({
    title: `Сила: вперед ${power}% на ${BASE_MS} мс`,
    expect: "градуси/с ростуть разом із потужністю; на підлозі видно, з якої потужності машина рушає",
    run: () => driveFor(power, BASE_MS),
  })),
  ...hideSteps(config).map((step) => ({
    title: `Hide: ${step.name}, ${step.power}% на ${step.ms} мс`,
    expect: "крок маневру hide з налаштувань .env",
    run: () => driveFor(step.power, step.ms, step.side),
  })),
];

const stopAndExit = (code: number): void => {
  if (car.status === "online") {
    car.stop();
  }
  input.close();
  setTimeout(() => process.exit(code), 300);
};

process.on("SIGINT", () => stopAndExit(0));

const main = async (): Promise<void> => {
  log(`Порти: хід ${config.drivePorts.join(",")}, інверсія ${config.driveInvertedPorts.join(",") || "—"}, кермо ${config.steerPort}${config.steerInverted ? " (інверсія)" : ""}`);
  log("Увімкніть хаб; після підключення кермо відкалібрується само (вліво до упору, вправо до упору, центр)");
  await car.start();
  await waitForHub();
  const steps = buildSteps();

  for (const [index, step] of steps.entries()) {
    console.log(`\n[${index + 1}/${steps.length}] ${step.title}`);
    console.log(`  Очікується: ${step.expect}`);
    const answer = (await input.question("  Enter — виконати, s — пропустити, q — вийти: ")).trim().toLowerCase();
    if (answer === "q") {
      break;
    }
    if (answer === "s") {
      continue;
    }
    const before = car.readings();
    const startedAt = Date.now();
    await step.run();
    console.log(`  Результат: ${formatDelta(before, car.readings(), Date.now() - startedAt - SETTLE_MS)}`);
  }

  log("Перевірку завершено");
  stopAndExit(0);
};

main().catch((error: unknown) => {
  log(`Помилка: ${error instanceof Error ? error.message : String(error)}`);
  stopAndExit(1);
});
