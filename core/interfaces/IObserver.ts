export interface IObserver {
  id: string;
  onUpdate: (data: unknown) => void;
}
