import { BasicMotor, Consts, PoweredUP, type BaseHub } from "node-poweredup";

const PORTS = ["A", "B", "C", "D"];
const PROBE_POWER = 30;
const PROBE_DURATION_MS = 1000;
const PAUSE_BETWEEN_MS = 1500;
const DEVICE_ATTACH_WAIT_MS = 1500;
const SCAN_TIMEOUT_MS = 30000;

const log = (message: string): void => {
  console.log(`[${new Date().toISOString()}] ${message}`);
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const findHub = (poweredUP: PoweredUP): Promise<BaseHub> =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      poweredUP.stop();
      reject(new Error(`Хаб не знайдено за ${SCAN_TIMEOUT_MS / 1000} с. Увімкни його кнопкою (має блимати).`));
    }, SCAN_TIMEOUT_MS);

    poweredUP.on("discover", (hub: BaseHub) => {
      clearTimeout(timeout);
      poweredUP.stop();
      resolve(hub);
    });
  });

const describePorts = (hub: BaseHub): void => {
  for (const port of PORTS) {
    const device = hub.getDeviceAtPort(port);
    const description = device ? `${device.typeName} (type ${device.type})` : "порожньо";
    log(`  порт ${port}: ${description}`);
  }
};

const spinMotors = async (hub: BaseHub): Promise<void> => {
  for (const port of PORTS) {
    const device = hub.getDeviceAtPort(port);
    if (!(device instanceof BasicMotor)) {
      continue;
    }
    log(`Порт ${port}: ${PROBE_POWER}% на ${PROBE_DURATION_MS} мс`);
    await device.setPower(PROBE_POWER);
    await sleep(PROBE_DURATION_MS);
    await device.brake();
    await sleep(PAUSE_BETWEEN_MS);
  }
};

const main = async (): Promise<void> => {
  const poweredUP = new PoweredUP();
  log("Шукаю хаб. Натисни кнопку на Technic Hub...");
  const hubFound = findHub(poweredUP);
  await poweredUP.scan();
  const hub = await hubFound;

  log(`Знайдено: ${hub.name} (тип ${Consts.HubType[hub.type]}), підключаюсь...`);
  await hub.connect();
  await sleep(DEVICE_ATTACH_WAIT_MS);
  log(`Підключено. Прошивка ${hub.firmwareVersion}, батарея ${hub.batteryLevel}%`);

  log("Пристрої на портах:");
  describePorts(hub);

  await spinMotors(hub);

  log("Готово, відключаюсь");
  await hub.disconnect();
  process.exit(0);
};

main().catch((error: unknown) => {
  log(`Помилка: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
