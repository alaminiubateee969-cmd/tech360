import { createElement } from "react";
import {
  Globe,
  Building2,
  ShoppingCart,
  Users,
  KeyRound,
  LayoutDashboard,
  MessageCircle,
  MessagesSquare,
  Mail,
  Smartphone,
  Workflow,
  Bot,
  BrainCircuit,
  Plug,
  Database,
  CloudUpload,
  Server,
  Code2,
  Wrench,
  Compass,
  Cloud,
  Eye,
  ShieldCheck,
  ImageOff,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Lock,
  FileCheck,
  Handshake,
  GraduationCap,
  Stethoscope,
  Home,
  UtensilsCrossed,
  Landmark,
  Scale,
  Factory,
  Truck,
  Plane,
  HardHat,
  Briefcase,
  Store,
  Cpu,
  PackageCheck,
  Layers,
  type LucideIcon,
} from "lucide-react";

/**
 * Maps the icon names used in src/data/site.ts to lucide-react components.
 * Unknown names fall back to a neutral icon so the UI never breaks.
 */
const ICONS: Record<string, LucideIcon> = {
  Globe,
  Building2,
  ShoppingCart,
  Users,
  KeyRound,
  LayoutDashboard,
  MessageCircle,
  MessagesSquare,
  Mail,
  Smartphone,
  Workflow,
  Bot,
  BrainCircuit,
  Plug,
  Database,
  CloudUpload,
  Cloud,
  Server,
  Code2,
  Wrench,
  Compass,
  Eye,
  ShieldCheck,
  ImageOff,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Lock,
  FileCheck,
  Handshake,
  GraduationCap,
  Stethoscope,
  Home,
  UtensilsCrossed,
  Landmark,
  Scale,
  Factory,
  Truck,
  Plane,
  HardHat,
  Briefcase,
  Store,
  Cpu,
  PackageCheck,
  Layers,
};

export function getIcon(name: string): LucideIcon {
  return ICONS[name] ?? Globe;
}

/** Renders a lucide icon by its data-file name. */
export function Icon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  // createElement keeps the icon reference stable (no component is created
  // during render — the module-level map owns every component reference).
  return createElement(getIcon(name), { className, "aria-hidden": true });
}
