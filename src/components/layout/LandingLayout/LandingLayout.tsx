import "./LandingLayout.css";
import type { ReactNode } from "react";

interface Props{
    children:ReactNode;
}

export default function LandingLayout({children}:Props){
    return(
        <main className="page-container" id="conteudo" tabIndex={-1}>
            {children}
        </main>
    );
}
