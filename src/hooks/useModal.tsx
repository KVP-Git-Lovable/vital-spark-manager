import { createContext, useContext, useState, ReactNode } from "react";

export type ModalType = "appointments" | null;

interface ModalContextType {
  openModal: ModalType;
  setOpenModal: (modal: ModalType) => void;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextType>({
  openModal: null,
  setOpenModal: () => {},
  closeModal: () => {},
});

export const useModal = () => useContext(ModalContext);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [openModal, setOpenModal] = useState<ModalType>(null);

  const closeModal = () => setOpenModal(null);

  return (
    <ModalContext.Provider value={{ openModal, setOpenModal, closeModal }}>
      {children}
    </ModalContext.Provider>
  );
}
