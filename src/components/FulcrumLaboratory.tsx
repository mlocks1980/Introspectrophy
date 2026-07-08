export type FulcrumLaboratoryProps = {
  activePattern: Record<string, unknown>;
  onCreateExperiment: (payload: { anchor_assumption: string; micro_experiment: string }) => void;
};

export function FulcrumLaboratory(_props: FulcrumLaboratoryProps) {
  return null;
}
