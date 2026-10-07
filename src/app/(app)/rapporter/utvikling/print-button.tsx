"use client";
import { Printer } from "lucide-react";
export default function PrintButton(){return <button className="button no-print" onClick={()=>window.print()}><Printer size={16}/> Skriv ut / lagre som PDF</button>}
