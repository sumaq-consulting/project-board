import { ProjectBoard } from '@/components/ProjectBoard';
import { PinGate } from '@/components/PinGate';

export default function Home() {
  return (
    <PinGate>
      <ProjectBoard />
    </PinGate>
  );
}
