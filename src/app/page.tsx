import Calculator from "@/components/Calculator/Calculator";
import { Widget } from "@/components/Widget";
import { WidgetEvents } from "@/components/WidgetEvents";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24 bg-black">
      <div className="z-10 w-11/12 max-w-5xl items-center justify-between font-mono text-sm lg:flex flex-col">
        <div className="flex flex-col bg-white w-6/12 p-10 rounded-xl">
          <Calculator />
          <WidgetEvents />
          <Widget />
        </div>
      </div>
    </main>
  );
}
