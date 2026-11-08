const VISION_STREAM_URL = process.env.NEXT_PUBLIC_VISION_STREAM_URL ?? "http://localhost:8001/stream";

export default function OperatorPanel() {
  return (
    <main className="flex flex-1 flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Панель оператора</h1>
      <div className="w-full max-w-4xl overflow-hidden rounded-lg border border-zinc-800 bg-black">
        <img src={VISION_STREAM_URL} alt="Відео з камери робота" className="block w-full" />
      </div>
    </main>
  );
}
