import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

export function IconButton({icon:Icon,label,onClick,className}: {icon:LucideIcon;label:string;onClick:()=>void;className?:string}) {return <Button className={className} variant="ghost" size="icon" aria-label={label} title={label} onClick={onClick}><Icon/></Button>}