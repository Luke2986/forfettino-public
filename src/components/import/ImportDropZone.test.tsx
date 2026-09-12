/**
 * Test per ImportDropZone.tsx
 *
 * Copertura:
 * - Copy migliorato: testo persuasivo con value proposition
 * - Formato supportato: solo .xml (NO .p7m — parser non lo supporta)
 * - Stato drag: testo "Rilascia" durante il drag
 * - Stato disabled: opacità ridotta e cursor-not-allowed
 * - Reset file input dopo selezione
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { ImportDropZone } from "./ImportDropZone";

describe("ImportDropZone", () => {
  const defaultProps = {
    onFilesSelected: vi.fn(),
    disabled: false,
  };

  describe("Copy migliorato", () => {
    it("mostra copy persuasivo con value proposition Forfettino", () => {
      render(<ImportDropZone {...defaultProps} />);

      expect(
        screen.getByText(/trascina.*fatture.*forfettino.*calcoli/i)
      ).toBeInTheDocument();
    });

    it("menziona il formato .xml FatturaPA", () => {
      render(<ImportDropZone {...defaultProps} />);

      expect(screen.getByText(/\.xml/)).toBeInTheDocument();
    });

    it("mostra 'Rilascia il file qui' durante il drag", () => {
      render(<ImportDropZone {...defaultProps} />);

      const dropZone = screen.getByText(/trascina/i).closest("div[class*='border-dashed']")!;
      fireEvent.dragOver(dropZone, { dataTransfer: { files: [] } });

      expect(screen.getByText("Rilascia il file qui")).toBeInTheDocument();
    });
  });

  describe("Stato disabled", () => {
    it("ha opacità ridotta quando disabled", () => {
      render(<ImportDropZone {...defaultProps} disabled={true} />);

      const dropZone = screen.getByText(/forfettino.*calcoli/i).closest("div[class*='border-dashed']")!;
      expect(dropZone.className).toMatch(/opacity-50/);
      expect(dropZone.className).toMatch(/cursor-not-allowed/);
    });
  });

  describe("Interazione file", () => {
    it("chiama onFilesSelected quando viene droppato un file", () => {
      const onFilesSelected = vi.fn();
      render(<ImportDropZone {...defaultProps} onFilesSelected={onFilesSelected} />);

      const dropZone = screen.getByText(/trascina/i).closest("div[class*='border-dashed']")!;

      const file = new File(["<xml>test</xml>"], "fattura.xml", { type: "text/xml" });
      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file] },
      });

      expect(onFilesSelected).toHaveBeenCalledTimes(1);
    });

    it("NON chiama onFilesSelected quando disabled", () => {
      const onFilesSelected = vi.fn();
      render(<ImportDropZone {...defaultProps} onFilesSelected={onFilesSelected} disabled={true} />);

      const dropZone = screen.getByText(/forfettino.*calcoli/i).closest("div[class*='border-dashed']")!;

      const file = new File(["<xml>test</xml>"], "fattura.xml", { type: "text/xml" });
      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file] },
      });

      expect(onFilesSelected).not.toHaveBeenCalled();
    });

    it("resetta il file input dopo la selezione per permettere reload dello stesso file", () => {
      const onFilesSelected = vi.fn();
      render(<ImportDropZone {...defaultProps} onFilesSelected={onFilesSelected} />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["<xml>test</xml>"], "fattura.xml", { type: "text/xml" });

      // Prima selezione
      fireEvent.change(fileInput, { target: { files: [file] } });
      expect(onFilesSelected).toHaveBeenCalledTimes(1);
      expect(fileInput.value).toBe("");
    });
  });
});
