import { createContext, useContext, useState, ReactNode } from "react";

export type ModalType = "appointments" | "appointmentDetail" | null;

interface ModalContextType {
  openModal: ModalType;
  selectedAppointmentId: string | null;
  setOpenModal: (modal: ModalType, appointmentId?: string) => void;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextType>({
  openModal: null,
  selectedAppointmentId: null,
  setOpenModal: () => {},
  closeModal: () => {},
});

export const useModal = () => useContext(ModalContext);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [openModal, setOpenModalState] = useState<ModalType>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

  const setOpenModal = (modal: ModalType, appointmentId?: string) => {
    setOpenModalState(modal);
    if (appointmentId) {
      setSelectedAppointmentId(appointmentId);
    }
  };

  const closeModal = () => {
    setOpenModalState(null);
    setSelectedAppointmentId(null);
  };

  return (
    <ModalContext.Provider value={{ openModal, selectedAppointmentId, setOpenModal, closeModal }}>
      {children}
    </ModalContext.Provider>
  );
}
