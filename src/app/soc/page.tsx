import type { Metadata } from "next";
import { Shell } from "@/components/Shell";
import { FlightRecorder } from "@/components/soc/FlightRecorder";

export const metadata: Metadata = {
  title: "Flight Recorder | AgentShield",
};

export default function SocPage() {
  return (
    <Shell active="soc">
      <FlightRecorder />
    </Shell>
  );
}
