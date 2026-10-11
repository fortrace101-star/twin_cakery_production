import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

export function IconButton({icon:Icon,label,onClick}: {icon:LucideIcon;label:string;onClick:()=>void}) {return <Button variant="ghost" size="icon" aria-label={label} title={label} onClick={onClick}><Icon/></Button>}