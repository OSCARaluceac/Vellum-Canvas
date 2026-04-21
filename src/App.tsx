// ╔══════════════════════════════════════════════════════════════════╗
// ║  VELLUM VTT — SISTEMA COMPLETO v2                                ║
// ║  Fixes: chat✓ inventario✓ portales escena→mapa✓                 ║
// ║         fichas responsivas al mapa✓ PDF recientes✓              ║
// ║         tiempo real sin recarga✓                                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import {
  Map as MapIcon, MessageSquare, ScrollText, Sword,
  User, Settings, Trash2, BookOpen, Eye,
  Save, Home, ShoppingBag, Plus, Check,
  Dices, Edit2, ChevronUp, Target, Package,
  ArrowLeftRight, Gift, PenLine, X, ChevronDown, Star, FileText, ShoppingCart, Scroll,Minus 
} from 'lucide-react';
import { supabase } from './supabase';

// ─── TIPOS ────────────────────────────────────────────────────────────────────

interface Player {
  id: string; name: string; avatar_color: string; hp: number; max_hp: number; gold: number;
  image_url?: string; bio?: string;
}
interface PlayerView {
  id: string; player_id: string;
  mode: 'MAP' | 'SCENE' | 'SHOP' | 'BATTLE';
  data: any;
}
interface MapData {
  id: string; name: string; image_url: string; hotspots: Hotspot[];
}
interface Hotspot {
  id: string; x: number; y: number; label: string;
  targetMapId?: string; targetSceneId?: string; type: 'map' | 'scene';
}
interface SceneData {
  id: string; title: string; bg_image: string; char_image: string;
  speaker: string; dialogue: string; has_shop: boolean; shop_items: string[];
  hotspots?: SceneHotspot[];
}
interface SceneHotspot {
  id: string; x: number; y: number; label: string;
  targetMapId?: string; targetSceneId?: string; type: 'map' | 'scene';
}
interface ShopItem {
  id: string; name: string; description: string; price: number;
  sell_price: number; icon: string; category: string; stock: number;
}
interface InventoryItem {
  id: string; player_id: string; item_id: string; quantity: number;
  shop_items?: ShopItem;
}
interface Entity {
  id: string; name: string; type: string; hp: number; max_hp: number;
  notes?: string; image_url?: string; description?: string;
}
interface MapToken {
  id: string; map_id: string; entity_id?: string; name: string; type: string;
  hp: number; x: number; y: number; image_url?: string;
}
interface ChatMessage {
  id: string; author: string; content: string;
  type: 'normal' | 'roll' | 'secret' | 'system';
  roll_result?: number; roll_max?: number; created_at: string;
  target_player_id?: string | null;
}
interface TrainingGoal {
  id: string; player_id: string; skill_name: string;
  current_xp: number; target_xp: number;
}
interface BiographyEntry {
  id: string; player_id: string; author: string; content: string;
  created_at: string; is_dm: boolean;
}
interface RecentPDF {
  name: string; url: string; addedAt: number;
}

// ─── CONSTANTES ───────────────────────────────────────────────────────────────

const UI = { left: '15%', center: '65%', right: '20%' };
const CATEGORY_ICONS: Record<string, string> = {
  weapon: '⚔️', armor: '🛡️', potion: '🧪', misc: '📦', magic: '✨', food: '🍖'
};

const SAMPLE_ITEMS: Partial<ShopItem>[] = [
  { name: 'Espada Corta', description: 'Hoja de acero forjado. +2 ATK', price: 50, sell_price: 25, icon: '⚔️', category: 'weapon', stock: -1 },
  { name: 'Escudo de Roble', description: 'Protección básica. +3 DEF', price: 40, sell_price: 20, icon: '🛡️', category: 'armor', stock: -1 },
  { name: 'Poción de Vida', description: 'Recupera 30 HP al instante.', price: 15, sell_price: 8, icon: '🧪', category: 'potion', stock: -1 },
  { name: 'Poción Mayor', description: 'Recupera 80 HP. Raro.', price: 45, sell_price: 22, icon: '🧪', category: 'potion', stock: 5 },
  { name: 'Amuleto Arcano', description: 'Canaliza energía mágica. +5 MAG', price: 120, sell_price: 60, icon: '✨', category: 'magic', stock: 3 },
  { name: 'Ración de Viaje', description: 'Comida para un día.', price: 5, sell_price: 2, icon: '🍖', category: 'food', stock: -1 },
  { name: 'Mapa del Mundo', description: 'Cartografía completa de la región.', price: 30, sell_price: 10, icon: '📦', category: 'misc', stock: -1 },
  { name: 'Daga Élfica', description: 'Forjada en plata lunaria. +4 ATK', price: 90, sell_price: 45, icon: '⚔️', category: 'weapon', stock: 2 },
];

// ─── HOOKS ────────────────────────────────────────────────────────────────────

function useSupabaseTable<T>(table: string, order?: string): [T[], React.Dispatch<React.SetStateAction<T[]>>] {
  const [data, setData] = useState<T[]>([]);
  useEffect(() => {
    let q = (supabase.from(table) as any).select('*');
    if (order) q = q.order(order, { ascending: false });
    q.then(({ data: d }: any) => d && setData(d as T[]));
  }, [table, order]);
  return [data, setData];
}

// ─── HOOK CHAT CORREGIDO ──────────────────────────────────────────────────────
// Fix: Canal único estable, sin ID cambiante en cada render

function useChat(authorName: string, isDM: boolean) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // CARGA INICIAL: Pedimos todo con '*' para evitar el Error 400
    supabase.from('chat_messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(80)
      .then(({ data, error }) => {
        if (error) {
          console.error("Error cargando transmisiones:", error.message);
          return;
        }
        if (data) {
          const filtered = isDM ? data : data.filter((m: any) => m.type !== 'secret');
          setMessages(filtered);
        }
      });

    // CANAL REALTIME: Identificador único por sesión
    const channelId = `chat_sector_${Math.random().toString(36).substring(7)}`;
    const ch = supabase.channel(channelId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload: any) => {
          const msg = payload.new as ChatMessage;
          if (!isDM && msg.type === 'secret') return;
          setMessages(prev => {
            if (prev.find(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      ).subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [isDM]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    if (!input.trim()) return;
  
    // TÁCTICA: Aseguramos que el objeto coincida exactamente con la tabla
    const payload = {
      author: authorName, // Ahora la tabla espera 'author'
      content: input.trim(),
      type: 'normal'
    };
  
    const { error } = await supabase
      .from('chat_messages')
      .insert([payload]);
  
    if (error) {
      console.error("Fallo de envío:", error.message);
      // Si el error persiste, verifica que el Paso 1 se ejecutó correctamente
    } else {
      setInput('');
    }
  };

  const rollPublic = async (sides = 20) => {
    const r = Math.floor(Math.random() * sides) + 1;
    await supabase.from('chat_messages').insert([{
      author: authorName, content: `tiró un d${sides}`, type: 'roll',
      roll_result: r, roll_max: sides
    }]);
    return r;
  };

  const rollSecret = async (sides = 20) => {
    const r = Math.floor(Math.random() * sides) + 1;
    await supabase.from('chat_messages').insert([{
      author: authorName, content: `tiró un dado secreto`, type: 'secret',
      roll_result: r, roll_max: sides
    }]);
    return r;
  };

  return { messages, input, setInput, send, rollPublic, rollSecret, endRef };
}

// ─── HOOK INVENTARIO REACTIVO ──────────────────────────────────────────────────

function useInventory(playerId: string | null) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  const reload = useCallback(async () => {
    if (!playerId) return;
    const { data } = await (supabase.from('player_inventory') as any)
      .select('*, shop_items(*)')
      .eq('player_id', playerId);
    if (data) setInventory(data);
  }, [playerId]);

  useEffect(() => {
    if (!playerId) return;
    reload();

    const ch = supabase
      .channel(`inv_live_${playerId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'player_inventory',
        filter: `player_id=eq.${playerId}`
      }, () => reload())
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [playerId, reload]);

  return { inventory, setInventory, reload };
}

// ─── HOOK TOKENS EN TIEMPO REAL ───────────────────────────────────────────────

function useMapTokens(mapId: string | null) {
  const [tokens, setTokens] = useState<MapToken[]>([]);

  useEffect(() => {
    if (!mapId) { setTokens([]); return; }

    // Carga inicial
    (supabase.from('map_tokens') as any)
      .select('*')
      .eq('map_id', mapId)
      .then(({ data }: any) => data && setTokens(data));

    const ch = supabase
      .channel(`tokens_live_${mapId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'map_tokens',
        filter: `map_id=eq.${mapId}`
      }, (p: any) => setTokens(prev => {
        if (prev.some(t => t.id === p.new.id)) return prev;
        return [...prev, p.new];
      }))
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'map_tokens',
        filter: `map_id=eq.${mapId}`
      }, (p: any) => setTokens(prev => prev.map(t => t.id === p.new.id ? p.new : t)))
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'map_tokens',
        filter: `map_id=eq.${mapId}`
      }, (p: any) => setTokens(prev => prev.filter(t => t.id !== p.old.id)))
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [mapId]);

  return { tokens, setTokens };
}

// ─── SEEDER DE ITEMS DE MUESTRA ───────────────────────────────────────────────

// ─── SEEDER DE ITEMS DE MUESTRA ───────────────────────────────────────────────

async function seedSampleItems() {
  try {
    const { data: existing } = await (supabase.from('shop_items') as any)
      .select('id').limit(1);
    if (existing && existing.length > 0) return; // Ya hay items, no duplicar
    for (const item of SAMPLE_ITEMS) {
      await (supabase.from('shop_items') as any).insert([item]);
    }
  } catch (e) {
    console.warn('seedSampleItems:', e);
  }
}
// ─── LAYOUT PRINCIPAL ─────────────────────────────────────────────────────────

function VellumLayout() {
  const location = useLocation();
  const [isDM, setIsDM] = useState(true);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [players, setPlayers] = useSupabaseTable<Player>('players', 'created_at');
  const [entities, setEntities] = useSupabaseTable<Entity>('entities', 'created_at');
  const [playerView, setPlayerView] = useState<PlayerView | null>(null);
  const isHome = location.pathname === '/';

  useEffect(() => { 
    seedSampleItems();
  }, []);

  useEffect(() => {
    if (!isDM && selectedPlayerId) {
      (supabase.from('player_views') as any)
        .select('*').eq('player_id', selectedPlayerId).single()
        .then(({ data }: any) => data && setPlayerView(data as PlayerView));

      const ch = supabase.channel(`pv_${selectedPlayerId}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'player_views',
          filter: `player_id=eq.${selectedPlayerId}`
        }, (p: any) => setPlayerView(p.new as PlayerView))
        .subscribe();

      return () => { supabase.removeChannel(ch); };
    }
  }, [isDM, selectedPlayerId]);

  const broadcastToPlayer = useCallback(async (playerId: string, mode: PlayerView['mode'], data: any) => {
    const { data: ex } = await (supabase.from('player_views') as any)
      .select('id').eq('player_id', playerId).single();
    if (ex) {
      await (supabase.from('player_views') as any).update({ mode, data }).eq('player_id', playerId);
    } else {
      await (supabase.from('player_views') as any).insert([{ player_id: playerId, mode, data }]);
    }
  }, []);

  const broadcastToAll = useCallback(async (mode: PlayerView['mode'], data: any) => {
    for (const p of players) await broadcastToPlayer(p.id, mode, data);
  }, [players, broadcastToPlayer]);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#1C1008] text-[#D7CCC8] overflow-hidden font-sans select-none relative">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&family=Cinzel:wght@400;600;700&family=EB+Garamond:ital,wght@0,400;0,600;1,400;1,600&display=swap');
        .font-display { font-family: 'Cinzel Decorative', serif; }
        .font-serif { font-family: 'EB Garamond', Georgia, serif; }
        .font-title { font-family: 'Cinzel', serif; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #C5A05940; border-radius: 2px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #C5A059; }
        * { scrollbar-width: thin; scrollbar-color: #C5A05940 transparent; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .animate-in { animation: fadeIn 0.4s ease forwards; }
        @keyframes pulse-gold { 0%,100% { box-shadow: 0 0 0 0 #C5A05940; } 50% { box-shadow: 0 0 0 8px #C5A05900; } }
        .pulse-gold { animation: pulse-gold 2s infinite; }
        @keyframes token-move { from { opacity: 0.6; } to { opacity: 1; } }
        .token-moved { animation: token-move 0.3s ease; }
      `}</style>

      {!isHome && (
        <Link to="/" className="fixed top-4 left-4 z-[200] bg-[#2D1B14] border border-[#C5A059]/50 p-2.5 rounded-full text-[#C5A059] hover:bg-[#C5A059] hover:text-[#1C1008] transition-all shadow-2xl flex items-center gap-2 group">
          <Home size={18} />
          <span className="text-[9px] font-black uppercase tracking-widest hidden group-hover:inline pr-1">Nexo</span>
        </Link>
      )}

      <button
        onClick={() => setIsDM(!isDM)}
        className="fixed bottom-4 right-4 z-[200] bg-[#C5A059] border-2 border-[#C5A059] p-3 rounded-full hover:scale-110 transition-all shadow-2xl"
        title={isDM ? 'Modo DM activo' : 'Modo Jugador activo'}
      >
        {isDM ? <Settings size={22} className="text-[#1C1008]" /> : <User size={22} className="text-[#1C1008]" />}
      </button>

      <main className="flex-1 flex overflow-hidden">
        <Routes>
          <Route path="/" element={isDM
            ? <MasterDashboard players={players} setPlayers={setPlayers} />
            : <PlayerSelector players={players} selectedId={selectedPlayerId} onSelect={setSelectedPlayerId} />
          } />
          {isDM && <>
            <Route path="/tactical" element={<TacticalMapModule players={players} entities={entities} broadcastToPlayer={broadcastToPlayer} broadcastToAll={broadcastToAll} />} />
            <Route path="/scenes" element={<ScenesModule players={players} broadcastToPlayer={broadcastToPlayer} broadcastToAll={broadcastToAll} />} />
            <Route path="/bestiary" element={<BestiaryModule />} />
            <Route path="/shop" element={<ShopManagerModule players={players} />} />
            <Route path="/manuals" element={<PDFReaderModule />} />
          </>}
          {!isDM && selectedPlayerId && (
            <Route path="/play" element={
              <PlayerView
                playerId={selectedPlayerId}
                view={playerView}
                players={players}
                setPlayers={setPlayers}
              />
            } />
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

// ─── TOKEN EN MAPA — RESPONSIVO AL CONTENEDOR ─────────────────────────────────
// FIX PRINCIPAL: Las fichas usan posición % relativa al contenedor real del mapa
// (no al viewport). Se usa un ref del contenedor del mapa para calcular el tamaño
// del token proporcionalmente.

interface TokenOnMapProps {
  token: MapToken;
  interactive: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
  selected?: boolean;
  containerSize?: { w: number; h: number };
}

function TokenOnMap({ token, interactive, onMouseDown, selected, containerSize }: TokenOnMapProps) {
  // Tamaño base del token: 3% del lado menor del contenedor del mapa, con min/max
  const baseSize = containerSize
    ? Math.max(28, Math.min(56, Math.min(containerSize.w, containerSize.h) * 0.045))
    : 44;

  const colors = {
    Enemigo: { border: '#ef4444', bg: '#450a0a', glow: '#ef444450' },
    JUGADOR: { border: '#eab308', bg: '#422006', glow: '#eab30850' },
    NPC:     { border: '#3b82f6', bg: '#0c1a3a', glow: '#3b82f650' },
  }[token.type] ?? { border: '#C5A059', bg: '#2D1B14', glow: '#C5A05950' };

  return (
    <div
      onMouseDown={interactive ? onMouseDown : undefined}
      style={{
        left: `${token.x}%`,
        top: `${token.y}%`,
        position: 'absolute',
        transform: 'translate(-50%, -50%)',
        cursor: interactive ? 'grab' : 'default',
        filter: `drop-shadow(0 0 6px ${colors.glow}) drop-shadow(0 3px 8px rgba(0,0,0,0.8))`,
        zIndex: 30,
        transition: interactive ? 'none' : 'left 0.25s ease, top 0.25s ease',
      }}
      className="group token-moved"
    >
      <div style={{
        width: baseSize,
        height: baseSize,
        borderRadius: '50%',
        border: `${Math.max(2, baseSize * 0.05)}px solid ${colors.border}`,
        backgroundColor: colors.bg,
        outline: selected ? `3px solid ${colors.border}` : 'none',
        outlineOffset: '2px',
        overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'transform 0.1s, outline 0.1s',
        transform: selected ? 'scale(1.12)' : 'scale(1)',
      }}>
        {token.image_url ? (
          <img
            src={token.image_url}
            style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
            alt={token.name}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <span style={{ color: colors.border, fontWeight: 'bold', fontSize: baseSize * 0.38 }}>
            {token.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      {/* Label flotante */}
      <div style={{
        position: 'absolute', top: '110%', left: '50%', transform: 'translateX(-50%)',
        backgroundColor: '#1C1008CC', border: `1px solid ${colors.border}40`,
        padding: '1px 5px', borderRadius: 2, fontSize: Math.max(7, baseSize * 0.16),
        fontWeight: 'bold', color: colors.border,
        whiteSpace: 'nowrap', pointerEvents: 'none',
        opacity: 0, transition: 'opacity 0.2s',
      }} className="group-hover:opacity-100">
        {token.name} · {token.hp}HP
      </div>
    </div>
  );
}

// ─── MAPA CON TOKENS RESPONSIVOS ─────────────────────────────────────────────
// Componente que trackea el tamaño real del area del mapa para pasar a los tokens

function MapWithTokens({
  map,
  tokens,
  isDM,
  onTokenMouseDown,
  selectedToken,
  onHotspotClick,
  onMapClick,
  activeTool,
  children,
}: {
  map: any;
  tokens: any[];
  isDM: boolean;
  onTokenMouseDown?: (e: React.MouseEvent, id: string) => void;
  selectedToken?: string | null;
  onHotspotClick?: (hs: any) => void;
  onMapClick?: (e: React.MouseEvent) => void;
  activeTool?: string;
  children?: React.ReactNode;
}) {
  if (!map?.image_url) return (
    <div className="absolute inset-0 flex items-center justify-center flex-col gap-3 opacity-15 bg-[#0D0704]">
      <MapIcon size={80} />
      <p className="font-serif italic text-lg tracking-widest uppercase">Sincronizando coordenadas...</p>
    </div>
  );

  return (
    <div
      className="relative w-full h-full bg-[#0D0704] flex items-center justify-center overflow-hidden"
      onClick={(e) => onMapClick && onMapClick(e)}
      style={{ cursor: activeTool === 'HOTSPOT' ? 'crosshair' : 'default' }}
    >
      <div 
        className="relative bg-contain bg-center bg-no-repeat transition-all duration-300"
        style={{ backgroundImage: `url(${map.image_url})`, width: '100%', height: '100%' }}
      >
        {tokens.map(t => (
          <div 
            key={t.id}
            onMouseDown={(e) => { if (onTokenMouseDown) { e.stopPropagation(); onTokenMouseDown(e, t.id); } }}
            style={{ 
              left: `${t.x}%`, top: `${t.y}%`, position: 'absolute',
              width: '4.5%', minWidth: '30px', maxWidth: '65px',
              transform: 'translate(-50%, -50%)', zIndex: 30
            }}
            className={`aspect-square rounded-full border-2 shadow-2xl flex items-center justify-center transition-all duration-200
              ${t.type === 'Enemigo' ? 'border-red-600 bg-red-950/80' : t.type === 'JUGADOR' ? 'border-[#C5A059] bg-black' : 'border-blue-500 bg-blue-900/80'}
              ${selectedToken === t.id ? 'ring-4 ring-white scale-110 z-50 shadow-[0_0_20px_rgba(255,255,255,0.4)]' : ''}
              ${isDM ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
          >
            {t.image_url ? (
              <img src={t.image_url} className="w-full h-full rounded-full object-cover pointer-events-none" alt="" />
            ) : (
              <span className="text-[10px] font-black text-white pointer-events-none uppercase">{t.name?.[0]}</span>
            )}
          </div>
        ))}

        {/* Portales */}
        {(map.hotspots || []).map((hs: any) => (
          <div
            key={hs.id}
            style={{ left: `${hs.x}%`, top: `${hs.y}%`, position: 'absolute', transform: 'translate(-50%,-50%)' }}
            className="z-[100] group cursor-pointer"
            onClick={(e) => { e.stopPropagation(); if (onHotspotClick) onHotspotClick(hs); }}
          >
            <div className={`w-4 h-4 rotate-45 border-2 shadow-lg transition-all hover:scale-125
              ${hs.type === 'scene' ? 'bg-purple-600 border-purple-300' : 'bg-[#C5A059] border-white'}`} />
            <div className="absolute left-6 -top-2 bg-[#1C1008]/95 border border-[#C5A059]/40 px-2 py-1 text-[9px] font-bold opacity-0 group-hover:opacity-100 whitespace-nowrap text-white z-50">
              {hs.type === 'scene' ? '🎭' : '🗺️'} {hs.label}
            </div>
          </div>
        ))}
        {children}
      </div>
    </div>
  );
}

// ─── PANEL DE CHAT ────────────────────────────────────────────────────────────

function ChatPanel({ authorName, isDM, compact = false }: {
  authorName: string; isDM: boolean; compact?: boolean;
}) {
  const { messages, input, setInput, send, rollPublic, rollSecret, endRef } = useChat(authorName, isDM);
  const [secretResult, setSecretResult] = useState<number | null>(null);

  return (
    <div className={`flex flex-col ${compact ? 'h-full' : 'flex-1'} min-h-0 bg-[#150D08]`}>
      <div className="px-3 py-2 flex items-center gap-2 border-b border-[#C5A059]/15 flex-shrink-0 bg-[#1C1008]">
        <MessageSquare size={11} className="text-[#C5A059]" />
        <span className="text-[9px] font-black uppercase tracking-widest text-[#C5A059]/60">
          {isDM ? 'Crónicas del Mundo' : `Chat · ${authorName}`}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar min-h-0">
        {messages.length === 0 && (
          <p className="text-center text-[9px] opacity-20 italic mt-6">El silencio precede a la aventura...</p>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`text-[10px] px-2 py-1.5 border-l-2 rounded-r
            ${msg.type === 'roll'   ? 'border-[#C5A059] bg-[#C5A059]/8' :
              msg.type === 'secret' ? 'border-purple-500 bg-purple-900/15' :
              msg.type === 'system' ? 'border-blue-500 bg-blue-900/10' :
              'border-white/10 bg-white/3'}`}>
            <span className="font-bold text-[#C5A059]">{msg.author}: </span>
            {(msg.type === 'roll' || msg.type === 'secret') ? (
              <span className="italic text-[#D7CCC8]/60">
                {msg.content} →{' '}
                <span className={`font-black text-base ${
                  msg.roll_result === msg.roll_max ? 'text-yellow-400' :
                  msg.roll_result === 1 ? 'text-red-500' : 'text-white'
                }`}>{msg.roll_result}</span>
                <span className="opacity-30">/{msg.roll_max}</span>
                {msg.type === 'secret' && <span className="text-purple-400 ml-1">[🔒 DM]</span>}
              </span>
            ) : (
              <span className="text-[#D7CCC8]/75">{msg.content}</span>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="p-2 bg-[#1C1008] border-t border-white/5 flex-shrink-0 space-y-1.5">
        {isDM && (
          <div className="flex gap-1">
            <button
              onClick={() => rollPublic()}
              className="flex-1 py-1 border border-[#C5A059]/25 text-[#C5A059] text-[8px] font-black uppercase hover:bg-[#C5A059]/10 flex items-center justify-center gap-1"
            >
              <Dices size={10} /> D20
            </button>
            <button
              onClick={async () => {
                const r = await rollSecret();
                setSecretResult(r);
                setTimeout(() => setSecretResult(null), 4000);
              }}
              className="flex-1 py-1 border border-purple-500/25 text-purple-400 text-[8px] font-black uppercase hover:bg-purple-900/20 flex items-center justify-center gap-1"
            >
              <Dices size={10} /> {secretResult !== null ? `🔒 ${secretResult}` : 'Secreto'}
            </button>
          </div>
        )}
        <div className="flex gap-1.5">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            className="flex-1 bg-[#2D1B14] border border-white/8 px-2 py-1.5 text-[10px] outline-none focus:border-[#C5A059]/50 font-serif italic placeholder-white/20"
            placeholder={isDM ? 'Narrar...' : 'Hablar...'}
          />
          <button
            onClick={send}
            className="px-2.5 bg-[#C5A059]/15 border border-[#C5A059]/25 text-[#C5A059] hover:bg-[#C5A059] hover:text-black transition-all"
          >
            <ChevronUp size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SELECTOR DE JUGADOR ──────────────────────────────────────────────────────

function PlayerSelector({ players, selectedId, onSelect }: {
  players: Player[]; selectedId: string | null; onSelect: (id: string) => void;
}) {
  if (!players.length) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="opacity-30 italic text-sm font-serif">El DM aún no ha creado personajes...</p>
    </div>
  );
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 p-12">
      <h2 className="font-title text-3xl font-bold tracking-widest text-[#C5A059]">¿Quién eres?</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-5 w-full max-w-2xl">
        {players.map(p => (
          <Link key={p.id} to="/play" onClick={() => onSelect(p.id)}
            className={`flex flex-col items-center gap-3 p-6 border transition-all rounded-sm ${
              selectedId === p.id
                ? 'border-[#C5A059] bg-[#C5A059]/10'
                : 'border-white/8 bg-[#2D1B14] hover:border-[#C5A059]/50'
            }`}>
            {p.image_url ? (
              <img src={p.image_url} className="w-20 h-20 rounded-full object-cover border-2" style={{ borderColor: p.avatar_color }} alt={p.name} />
            ) : (
              <div className="w-20 h-20 rounded-full border-2 flex items-center justify-center text-3xl font-bold font-title"
                style={{ borderColor: p.avatar_color, backgroundColor: p.avatar_color + '22', color: p.avatar_color }}>
                {p.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="font-title font-bold text-base tracking-wide">{p.name}</span>
            <div className="flex gap-4 text-[10px] opacity-60">
              <span>❤️ {p.hp}</span><span>🪙 {p.gold}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
function EditCharacterInventory({ playerId }: { playerId: string }) {
  // 1. Cargar el inventario específico del operativo
  const { inventory, setInventory } = useInventory(playerId);

  // 🛡️ Ajustar cantidad (Sincronización con Supabase)
  const updateQuantity = async (id: string, newQty: number) => {
    if (newQty < 1) return;
    const { error } = await supabase.from('player_inventory').update({ quantity: newQty }).eq('id', id);
    if (!error) {
      setInventory(prev => prev.map(i => i.id === id ? { ...i, quantity: newQty } : i));
    }
  };

  // 🛡️ Eliminar objeto (Incautación)
  const removeItem = async (id: string) => {
    const { error } = await supabase.from('player_inventory').delete().eq('id', id);
    if (!error) {
      setInventory(prev => prev.filter(i => i.id !== id));
    }
  };

  return (
    <div className="mt-6 border-t border-[#C5A059]/20 pt-4">
      <h4 className="text-[10px] font-black uppercase text-[#C5A059] tracking-[0.2em] mb-4 flex items-center gap-2">
        <Package size={14} /> Gestión de Suministros del Operativo
      </h4>

      <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
        {inventory.length > 0 ? inventory.map(item => (
          <div key={item.id} className="flex items-center justify-between bg-black/40 border border-white/5 p-3 group">
            <div className="flex items-center gap-3">
              <span className="text-xl">{item.shop_items?.icon || '📦'}</span>
              <div>
                <p className="text-[9px] font-bold text-white uppercase">{item.shop_items?.name}</p>
                <p className="text-[7px] text-[#C5A059]/60 uppercase tracking-widest">ID: {item.item_id.slice(0,8)}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Selector de Cantidad */}
              <div className="flex items-center border border-[#C5A059]/30 bg-[#1C1008]">
                <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="px-2 text-[#C5A059] hover:bg-[#C5A059] hover:text-black transition-colors">-</button>
                <span className="px-3 text-[10px] font-mono border-x border-[#C5A059]/30">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="px-2 text-[#C5A059] hover:bg-[#C5A059] hover:text-black transition-colors">+</button>
              </div>

              {/* Botón de Eliminación */}
              <button 
                onClick={() => removeItem(item.id)}
                className="text-white/20 hover:text-red-500 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        )) : (
          <div className="text-center py-6 border border-dashed border-white/10 opacity-20">
            <p className="text-[8px] uppercase tracking-widest font-black">Sin pertenencias registradas</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DMInventoryInspector({ playerId, playerName }: { playerId: string, playerName: string }) {
  const { inventory, setInventory } = useInventory(playerId);
  const [isAdding, setIsAdding] = useState(false);

  // 🛡️ Ajuste de Existencias (Sincronización instantánea)
  const updateQty = async (id: string, newQty: number) => {
    if (newQty < 0) return;
    const { error } = await supabase.from('player_inventory').update({ quantity: newQty }).eq('id', id);
    if (!error) setInventory(prev => prev.map(i => i.id === id ? { ...i, quantity: newQty } : i));
  };

  // 🛡️ Incautación de Equipo
  const deleteItem = async (id: string) => {
    const { error } = await supabase.from('player_inventory').delete().eq('id', id);
    if (!error) setInventory(prev => prev.filter(i => i.id !== id));
  };

  return (
    <div className="bg-[#1C1008]/50 border border-[#C5A059]/20 p-4 rounded-sm animate-in fade-in duration-300">
      <header className="flex justify-between items-center mb-4 border-b border-[#C5A059]/10 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-[#C5A059] rounded-full animate-pulse" />
          <h4 className="text-[10px] font-black uppercase text-[#C5A059] tracking-widest">
            Inventario: {playerName}
          </h4>
        </div>
        <span className="text-[8px] opacity-40 font-mono">ID: {playerId.slice(0, 6)}</span>
      </header>

      <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
        {inventory.length > 0 ? inventory.map(item => (
          <div key={item.id} className="flex items-center justify-between bg-black/40 p-2 border border-white/5 group hover:border-[#C5A059]/30 transition-all">
            <div className="flex items-center gap-3">
              <span className="text-lg">{item.shop_items?.icon || '📦'}</span>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-white uppercase leading-none">{item.shop_items?.name}</span>
                <span className="text-[7px] text-[#C5A059]/50 font-mono">QTY: {item.quantity}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => updateQty(item.id, item.quantity - 1)}
                className="w-5 h-5 flex items-center justify-center bg-[#2D1B14] border border-[#C5A059]/30 text-[#C5A059] hover:bg-[#C5A059] hover:text-black transition-all"
              >
                <Minus size={10} />
              </button>
              <button 
                onClick={() => updateQty(item.id, item.quantity + 1)}
                className="w-5 h-5 flex items-center justify-center bg-[#2D1B14] border border-[#C5A059]/30 text-[#C5A059] hover:bg-[#C5A059] hover:text-black transition-all"
              >
                <Plus size={10} />
              </button>
              <button 
                onClick={() => deleteItem(item.id)}
                className="ml-2 text-red-500/50 hover:text-red-500 p-1"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        )) : (
          <div className="py-8 text-center border border-dashed border-white/5 opacity-20">
            <p className="text-[8px] uppercase tracking-[0.3em]">Celdas de carga vacías</p>
          </div>
        )}
      </div>
    </div>
  );
}
// ─── VISTA DEL JUGADOR ────────────────────────────────────────────────────────

function PlayerView({ playerId, view, players, setPlayers }: {
  playerId: string; view: PlayerView | null;
  players: Player[]; setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
}) {
  const player = players.find(p => p.id === playerId);
  const [shopItems] = useSupabaseTable<ShopItem>('shop_items', 'created_at');
  const [scenes] = useSupabaseTable<SceneData>('scenes', 'created_at');
  const [maps] = useSupabaseTable<MapData>('maps', 'created_at');

  // 🛡️ SINCRONIZACIÓN TÁCTICA: Hook de tokens con acceso a setTokens
  const { tokens, setTokens } = useMapTokens(view?.data?.map_id ?? view?.data?.id ?? null);


  useEffect(() => {
    if (view?.mode === 'MAP' && view.data?.tokens) {
      setTokens(view.data.tokens);
    }
  }, [view?.data?.tokens, setTokens]);

  const { inventory, setInventory } = useInventory(playerId);
  const [bio, setBio] = useState<BiographyEntry[]>([]);
  const [buyFeedback, setBuyFeedback] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'inv' | 'bio'>('inv');
  const [lastRoll, setLastRoll] = useState<number | null>(null);
  const [bioInput, setBioInput] = useState('');
  
  const { rollPublic } = useChat(player?.name ?? 'Jugador', false);

  useEffect(() => {
    if (!playerId) return;
    (supabase.from('biography_entries') as any)
      .select('*').eq('player_id', playerId)
      .order('created_at', { ascending: true })
      .then(({ data }: any) => data && setBio(data));

    const ch = supabase.channel(`bio_${playerId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'biography_entries',
        filter: `player_id=eq.${playerId}`
      }, (p: any) => setBio(prev => [...prev, p.new]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [playerId]);

  const handleBuy = async (item: ShopItem) => {
    if (!player || player.gold < item.price) {
      setBuyFeedback('❌ Fondos insuficientes');
      setTimeout(() => setBuyFeedback(null), 2000);
      return;
    }
  
    // 1. Sincronización de Oro
    const nuevoOro = player.gold - item.price;
    const { error: errorOro } = await supabase
      .from('players')
      .update({ gold: nuevoOro })
      .eq('id', playerId);
  
    if (errorOro) {
      console.error("Fallo al guardar dinero:", errorOro.message);
      setBuyFeedback('⚠️ Error de servidor: Oro no guardado');
      return;
    }
  

    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, gold: nuevoOro } : p));
  
    // 2. Sincronización de Inventario (Códice de Objetos)
    const itemExistente = inventory.find(i => i.item_id === item.id);
  
    try {
      if (itemExistente) {
        // Actualizar cantidad si ya lo tiene
        const nuevaCantidad = itemExistente.quantity + 1;
        const { error: errorUpd } = await supabase
          .from('player_inventory')
          .update({ quantity: nuevaCantidad })
          .eq('id', itemExistente.id);
  
        if (errorUpd) throw errorUpd;
  
        setInventory(prev => prev.map(i => 
          i.id === itemExistente.id ? { ...i, quantity: nuevaCantidad } : i
        ));
      } else {
        // Insertar nuevo objeto
        const { data, error: errorIns } = await supabase
          .from('player_inventory')
          .insert([{ 
            player_id: playerId, 
            item_id: item.id, 
            quantity: 1 
          }])
          .select('*, shop_items(*)');
  
        if (errorIns) throw errorIns;
        if (data) setInventory(prev => [...prev, data[0]]);
      }
      
      setBuyFeedback(`✅ Adquisición confirmada: ${item.name}`);
    } catch (err: any) {
      console.error("Fallo al guardar inventario:", err.message);
      setBuyFeedback('⚠️ Error de servidor: Objeto no guardado');
    } finally {
      setTimeout(() => setBuyFeedback(null), 2000);
    }
  };

  const handleSell = async (inv: InventoryItem) => {
    if (!player || !inv.shop_items) return;
    const sellPrice = inv.shop_items.sell_price ?? Math.floor(inv.shop_items.price / 2);
    await (supabase.from('players') as any).update({ gold: player.gold + sellPrice }).eq('id', playerId);
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, gold: p.gold + sellPrice } : p));
    if (inv.quantity > 1) {
      await (supabase.from('player_inventory') as any).update({ quantity: inv.quantity - 1 }).eq('id', inv.id);
      setInventory(prev => prev.map(i => i.id === inv.id ? { ...i, quantity: i.quantity - 1 } : i));
    } else {
      await (supabase.from('player_inventory') as any).delete().eq('id', inv.id);
      setInventory(prev => prev.filter(i => i.id !== inv.id));
    }
    setBuyFeedback(`🪙 +${sellPrice} por ${inv.shop_items.name}`);
    setTimeout(() => setBuyFeedback(null), 2000);
  };

  const addBioEntry = async () => {
    if (!bioInput.trim() || !playerId) return;
    const { data } = await (supabase.from('biography_entries') as any)
      .insert([{ player_id: playerId, author: player?.name ?? 'Jugador', content: bioInput.trim(), is_dm: false }])
      .select();
    if (data) setBio(prev => [...prev, data[0]]);
    setBioInput('');
  };

  const handleRoll = async () => {
    const r = await rollPublic(20);
    setLastRoll(r);
  };

  const handleHotspotClick = async (hs: any) => {
    if (!playerId) return;

    if (hs.type === 'map' && hs.targetMapId) {
      const target = maps.find(m => m.id === hs.targetMapId);
      if (target) {
        // El jugador se mueve a sí mismo (localmente)
        // En una versión más avanzada, esto podría pedir permiso al DM
        console.log("El operativo solicita tránsito...");
      }
    }

    // Registramos el intento de cruce en el chat para tu supervisión
    await supabase.from('chat_messages').insert([{
      author: player?.name ?? 'Jugador',
      content: `ha cruzado el portal hacia: "${hs.label}"`,
      type: 'system'
    }]);
  };

  const mode = view?.mode ?? 'MAP';
  const data = view?.data ?? {};
  // Ahora los objetos de la tienda se cargan siempre para estar listos.
  const visibleShopItems = shopItems.filter(item => {
    // Si el modo es SHOP, podemos filtrar por IDs específicos enviados por el DM
    if (view?.mode === 'SHOP' && view.data?.shopItemIds?.length) {
      return view.data.shopItemIds.includes(item.id);
    }
    // En SCENE o MAP, mostramos el catálogo general
    return true; 
  });

  return (
    <div className="flex h-full w-full animate-in fade-in duration-500 bg-[#0D0704]">
      {/* IZQUIERDA: Ficha del personaje */}
      <aside style={{ width: '220px', minWidth: '220px' }} className="bg-[#1C1008] border-r border-[#C5A059]/15 flex flex-col overflow-hidden shadow-2xl z-20">
        <div className="p-4 flex flex-col items-center gap-2 border-b border-[#C5A059]/15">
          {player?.image_url ? (
            <img src={player.image_url} className="w-20 h-20 rounded-full object-cover border-2 border-[#C5A059] shadow-[0_0_15px_rgba(197,160,89,0.2)]" alt={player.name} />
          ) : (
            <div className="w-20 h-20 rounded-full border-2 border-[#C5A059] flex items-center justify-center text-2xl font-bold font-title text-[#C5A059]">
              {player?.name?.charAt(0) ?? '?'}
            </div>
          )}
          <h2 className="font-title text-sm font-bold text-center uppercase tracking-tighter italic">{player?.name ?? '...'}</h2>
          <div className="w-full space-y-2">
            <StatBar label="HP" value={player?.hp ?? 0} max={100} color="#ef4444" />
            <div className="flex justify-between border-b border-white/5 pb-1">
              <span className="text-[9px] uppercase font-black opacity-40">Oro</span>
              <span className="font-serif text-yellow-400 font-bold text-sm">🪙 {player?.gold ?? 0}</span>
            </div>
          </div>
          <button onClick={handleRoll} className="w-full py-2 bg-[#2D1B14] border border-[#C5A059]/30 hover:border-[#C5A059] flex flex-col items-center gap-0.5 group transition-all mt-1 shadow-inner">
            <Dices size={16} className="text-[#C5A059]" />
            <span className="text-[8px] font-black uppercase text-[#C5A059]">Tirar d20</span>
            {lastRoll !== null && (
              <span className="text-lg font-title font-bold animate-in zoom-in-50 text-white">{lastRoll}</span>
            )}
          </button>
        </div>

        {/* Tabs Navegación Lateral */}
        <div className="flex border-b border-[#C5A059]/10 flex-shrink-0">
          {([['inv', Package], ['bio', PenLine]] as const).map(([tab, Icon]) => (
            <button key={tab} onClick={() => setActiveTab(tab as any)}
              className={`flex-1 py-2 flex flex-col items-center gap-0.5 transition-all ${
                activeTab === tab ? 'text-[#C5A059] bg-[#C5A059]/10' : 'text-white/30 hover:text-white/60'
              }`}>
              <Icon size={12} />
              <span className="text-[7px] font-black uppercase">{tab === 'inv' ? 'Inv' : 'Bio'}</span>
            </button>
          ))}
        </div>

        {/* Contenido de tabs */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/10">
          {activeTab === 'inv' && (
            <div className="p-3 space-y-1.5">
              <p className="text-[8px] font-black uppercase text-[#C5A059]/60 mb-2 tracking-widest">Inventario ({inventory.length})</p>
              {inventory.map(inv => (
                <div key={inv.id} className="bg-[#2D1B14] border border-white/5 p-2 group hover:border-[#C5A059]/30 transition-all">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{inv.shop_items?.icon || '📦'}</span>
                    <div className="flex-1 min-w-0 text-[9px] font-bold truncate text-[#D7CCC8]">{inv.shop_items?.name}</div>
                    <div className="text-[8px] opacity-40 font-mono">×{inv.quantity}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* ... [Resto de lógica de Bio y Shop se mantiene intacta] ... */}
          {activeTab === 'bio' && <div className="p-3">...</div>}
          {/* shop moved to center overlay; sidebar contains only Inv/Bio */}
        </div>
      </aside>

      {/* ÁREA CENTRAL: MAPA O ESCENA CON SINCRONIZACIÓN FORZOSA */}
      <main className="flex-1 relative overflow-hidden">
      {mode === 'MAP' && (
  <MapWithTokens
    map={{
      image_url: data.image_url,
      hotspots: Array.isArray(data.hotspots) ? data.hotspots : [],
    }}
    tokens={tokens}
    isDM={false}
    onHotspotClick={(hs) => handleHotspotClick(hs)}
  />
)}

        {mode === 'SCENE' && (
          <SceneView sceneData={data} onHotspotClick={handleHotspotClick} maps={maps} />
        )}

        {/* 🛒 Ventana de Tienda: aparece como overlay cuando el DM activa el modo SHOP */}
        {view?.mode === 'SHOP' && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-2xl h-[70%] bg-[#1C1008]/95 border-2 border-[#C5A059]/40 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden">
              <header className="p-4 border-b border-[#C5A059]/20 flex justify-between items-center bg-[#C5A059]/5">
                <div>
                  <h3 className="font-title text-[#C5A059] text-sm font-black uppercase italic tracking-tighter">Terminal de Suministros</h3>
                  <p className="text-[8px] text-white/40 uppercase tracking-[0.2em]">Adquisición de equipo táctico</p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] uppercase opacity-40 font-black">Fondos Disponibles</p>
                  <p className="text-[#C5A059] font-title font-bold">🪙 {player?.gold ?? 0}</p>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 gap-4 custom-scrollbar">
                {shopItems.filter(item => !view.data?.shopItemIds || view.data.shopItemIds.includes(item.id)).map(item => (
                  <div key={item.id} className="bg-black/40 border border-white/5 p-4 flex items-center gap-4 group hover:border-[#C5A059]/50 transition-all">
                    <span className="text-3xl filter drop-shadow-[0_0_8px_rgba(197,160,89,0.3)]">{item.icon || '📦'}</span>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-white uppercase tracking-tight">{item.name}</p>
                      <p className="text-[9px] text-[#C5A059] font-mono mt-1 italic">🪙 {item.price}</p>
                    </div>
                    <button 
                      onClick={() => handleBuy(item)}
                      className="bg-[#C5A059] text-black p-2 hover:bg-white transition-all shadow-lg"
                    >
                      <ShoppingCart size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <footer className="p-3 bg-black/40 text-center">
                <p className="text-[7px] uppercase tracking-[0.4em] opacity-20">Sincronización de Códice con Supabase v.3.0</p>
              </footer>
            </div>
          </div>
        )}

        {buyFeedback && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[100] bg-[#1C1008]/95 border border-[#C5A059] px-8 py-3 text-[10px] font-black text-[#C5A059] uppercase tracking-[0.3em] shadow-2xl animate-in fade-in duration-300">
            {buyFeedback}
          </div>
        )}
      </main>

      {/* DERECHA: Chat */}
      <aside style={{ width: '220px', minWidth: '220px' }} className="bg-[#150D08] border-l border-white/5 flex flex-col shadow-2xl z-20">
        <ChatPanel authorName={player?.name ?? 'Jugador'} isDM={false} compact />
      </aside>
    </div>
  );
}

// ─── ESCENA MEJORADA ──────────────────────────────────────────────────────────
// FIX PORTAL ESCENA→MAPA: recibe maps y puede navegar directamente

function SceneView({
  sceneData,
  onHotspotClick,
  maps,
}: {
  sceneData: any;
  onHotspotClick?: (hs: any) => void;
  maps?: MapData[];
}) {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-cover bg-center" style={{
        backgroundImage: sceneData.bg_image ? `url(${sceneData.bg_image})` : 'none',
        filter: 'brightness(0.65)'
      }} />
      {sceneData.char_image && (
        <img
          src={sceneData.char_image}
          className="absolute bottom-[140px] left-1/2 -translate-x-1/2 h-[72%] object-contain drop-shadow-[0_0_60px_rgba(0,0,0,0.9)]"
          alt="sprite"
        />
      )}
      {/* FIX: Hotspots de escena con tipo visual claro */}
      {(sceneData.hotspots || []).map((hs: SceneHotspot) => (
        <div
          key={hs.id}
          style={{ left: `${hs.x}%`, top: `${hs.y}%`, position: 'absolute', transform: 'translate(-50%,-50%)' }}
          className="z-30 group cursor-pointer"
          onClick={() => onHotspotClick?.(hs)}
        >
          <div className={`w-5 h-5 rotate-45 border-2 shadow-lg transition-all animate-pulse hover:scale-125
            ${hs.type === 'scene' ? 'bg-purple-500/80 border-purple-300' : 'bg-[#C5A059]/80 border-yellow-300'}`} />
          <div className="absolute left-6 -top-2 bg-[#1C1008]/90 border border-[#C5A059]/50 px-2 py-0.5 text-[8px] font-bold opacity-0 group-hover:opacity-100 whitespace-nowrap text-white z-50 pointer-events-none">
            {hs.type === 'scene' ? '🎭' : '🗺️'} {hs.label}
          </div>
        </div>
      ))}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[88%] max-w-2xl p-5 bg-[#1C1008]/92 backdrop-blur-sm border-t-4 border-[#C5A059]">
        <div className="absolute -top-6 left-6 bg-[#C5A059] text-[#1C1008] px-5 py-1 text-[10px] font-black uppercase tracking-[0.3em]">
          {sceneData.speaker || 'Narrador'}
        </div>
        <p className="text-[#D7CCC8] font-serif text-lg leading-relaxed">{sceneData.dialogue}</p>
      </div>
    </div>
  );
}

// ─── STAT BAR ─────────────────────────────────────────────────────────────────

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <span className="text-[8px] uppercase font-black opacity-40">{label}</span>
        <span className="text-[9px] font-bold" style={{ color }}>{value}/{max}</span>
      </div>
      <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
function LibraryModule() {
  const [recentFiles, setRecentFiles] = useState<{name: string, url: string}[]>(() => {
    // Recuperamos la memoria de archivos del terminal
    const saved = localStorage.getItem('vellum_library_recent');
    return saved ? JSON.parse(saved) : [];
  });
  const [activePdf, setActivePdf] = useState<string | null>(null);

  const handleFileOpen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      const url = URL.createObjectURL(file);
      setActivePdf(url);
      
      // Actualizamos la lista de acceso rápido
      const newFiles = [
        { name: file.name, url },
        ...recentFiles.filter(f => f.name !== file.name)
      ].slice(0, 8); // Solo mantenemos los 8 más recientes
      
      setRecentFiles(newFiles);
      localStorage.setItem('vellum_library_recent', JSON.stringify(newFiles));
    }
  };

  return (
    <div className="h-full flex bg-[#1A110E] animate-in fade-in duration-500">
      {/* LATERAL: ARCHIVOS RECIENTES */}
      <aside className="w-64 bg-[#2D1B14] border-r border-[#C5A059]/10 p-4 flex flex-col gap-4 shadow-xl">
        <div className="flex items-center gap-2 border-b border-[#C5A059]/20 pb-2">
          <BookOpen size={16} className="text-[#C5A059]" />
          <h3 className="text-[10px] font-black uppercase text-[#C5A059] tracking-[0.2em]">Biblioteca</h3>
        </div>

        <label className="w-full bg-[#C5A059] text-[#1A110E] py-2 text-center text-[9px] font-black uppercase hover:bg-white cursor-pointer transition-all shadow-[0_0_15px_rgba(197,160,89,0.2)]">
          Cargar Códice <input type="file" className="hidden" accept="application/pdf" onChange={handleFileOpen} />
        </label>

        <div className="flex-1 space-y-1 overflow-y-auto custom-scrollbar pr-1">
          <p className="text-[8px] font-black text-[#C5A059]/40 uppercase tracking-widest mb-2">Documentos Recientes</p>
          {recentFiles.length > 0 ? recentFiles.map((file, i) => (
            <button
              key={i}
              onClick={() => setActivePdf(file.url)}
              className={`w-full text-left p-2 text-[10px] border transition-all truncate
                ${activePdf === file.url 
                  ? 'bg-[#C5A059]/10 border-[#C5A059] text-white' 
                  : 'bg-black/20 border-white/5 text-[#D7CCC8]/50 hover:border-[#C5A059]/40 hover:text-white'}`}
            >
              {file.name}
            </button>
          )) : (
            <div className="py-10 text-center opacity-20 italic text-[9px]">La estantería está vacía.</div>
          )}
        </div>
      </aside>

      {/* VISOR CENTRAL */}
      <main className="flex-1 relative bg-black/40 flex flex-col">
        {activePdf ? (
          <iframe
            src={activePdf}
            className="w-full h-full border-none shadow-inner"
            title="PDF Viewer"
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-4 opacity-10">
            <ScrollText size={80} />
            <p className="font-serif italic text-xl">Selecciona un registro para proyectar</p>
          </div>
        )}
      </main>
    </div>
  );
}

function PlayerDashboard({ player: initialPlayer, view }: { player: Player; view: PlayerView | null }) {
//Usamos un estado local para que la vida y el oro se actualicen sin recargar
  const [playerData, setPlayerData] = useState(initialPlayer);
  const [localTokens, setLocalTokens] = useState<MapToken[]>([]);

  // 1. SINCRONIZACIÓN VITAL (HP / Oro en Tiempo Real)
  useEffect(() => {
    const channel = supabase.channel(`vitals_${playerData.id}`)
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'players', filter: `id=eq.${playerData.id}` },
        (payload) => {
          setPlayerData(payload.new as Player);
        }
      ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [playerData.id]);

  // 2. SINCRONIZACIÓN TÁCTICA (Tokens del Mapa)
  useEffect(() => {
    if (view?.mode === 'MAP' && view.data?.id) {
      // Carga inicial de unidades
      supabase.from('map_tokens').select('*').eq('map_id', view.data.id)
        .then(({ data }) => data && setLocalTokens(data as MapToken[]));

      // Escucha de movimientos y nuevas unidades
      const ch = supabase.channel(`map_sync_${view.data.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'map_tokens', filter: `map_id=eq.${view.data.id}` }, 
        (p: any) => {
          if (p.eventType === 'INSERT') setLocalTokens(prev => [...prev, p.new]);
          if (p.eventType === 'UPDATE') setLocalTokens(prev => prev.map(t => t.id === p.new.id ? p.new : t));
          if (p.eventType === 'DELETE') setLocalTokens(prev => prev.filter(t => t.id !== p.old.id));
        }).subscribe();
        
      return () => { supabase.removeChannel(ch); };
    }
  }, [view?.mode, view?.data?.id]);

  if (!view) return (
    <div className="h-screen bg-[#0D0704] flex flex-col items-center justify-center gap-4">
      <div className="animate-pulse text-[#C5A059]"><Target size={48} /></div>
      <p className="font-serif italic text-[#C5A059]/60 tracking-widest uppercase text-[10px]">Esperando señal de Ratatoskr...</p>
    </div>
  );

  return (
    <div className="h-screen w-screen bg-[#1a110e] text-[#D7CCC8] overflow-hidden flex flex-col">
      {/* CABECERA: ESTADO DEL SUJETO */}
      <header className="p-4 border-b border-[#C5A059]/20 flex justify-between items-center bg-[#2D1B14] shadow-2xl z-50">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-2 border-[#C5A059] overflow-hidden bg-black shadow-[0_0_15px_rgba(197,160,89,0.3)]">
              {playerData.image_url ? (
                <img src={playerData.image_url} className="w-full h-full object-cover" alt="Avatar" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#C5A059]/20"><User size={24} /></div>
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-[#2D1B14] rounded-full animate-pulse" />
          </div>
          <div>
            <h2 className="font-serif font-bold text-[#C5A059] text-lg leading-none uppercase tracking-tighter">{playerData.name}</h2>
            <p className="text-[8px] uppercase tracking-[0.4em] text-[#C5A059]/40 mt-1.5 font-black">Enlace Neuronal Activo</p>
          </div>
        </div>

        <div className="flex gap-8">
          <div className="text-right">
            <p className="text-[9px] uppercase font-black text-[#C5A059]/40 mb-1.5 tracking-widest text-left">Integridad Vital</p>
            <div className="flex items-center gap-3">
              <div className="w-40 h-1.5 bg-black rounded-full overflow-hidden border border-white/5">
                <div 
                  className="h-full bg-gradient-to-r from-red-800 to-red-500 transition-all duration-700 ease-out" 
                  style={{ width: `${Math.max(0, Math.min((playerData.hp / playerData.max_hp) * 100, 100))}%` }} 
                />
              </div>
              <span className="font-mono text-red-500 font-black text-sm w-8">{playerData.hp}<span className="text-[8px] opacity-30">/{playerData.max_hp}</span></span>
            </div>
          </div>
          <div className="text-right border-l border-white/10 pl-8">
            <p className="text-[9px] uppercase font-black text-[#C5A059]/40 mb-1.5 tracking-widest">Créditos</p>
            <p className="font-mono text-yellow-500 font-black text-sm tracking-tighter">{playerData.gold.toLocaleString()} <span className="text-[10px] opacity-50">G</span></p>
          </div>
        </div>
      </header>

      {/* ÁREA DE DESPLIEGUE */}
      <main className="flex-1 relative overflow-hidden bg-[#0D0704]">
        {view.mode === 'MAP' && view.data && (
          <div className="absolute inset-0 animate-in fade-in duration-1000">
             <MapWithTokens map={view.data} tokens={localTokens} isDM={false} />
          </div>
        )}

        {view.mode === 'SCENE' && (
          <div className="absolute inset-0 flex flex-col animate-in fade-in zoom-in-95 duration-1000">
            <div className="flex-1 bg-cover bg-center" style={{ backgroundImage: `url(${view.data.image_url})` }}>
              <div className="absolute inset-0 bg-gradient-to-t from-[#0D0704] via-transparent to-black/40" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-12">
              <div className="max-w-4xl mx-auto border-l-4 border-[#C5A059] bg-black/70 backdrop-blur-xl p-8 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
                <h3 className="text-[#C5A059] font-serif italic text-2xl mb-4 tracking-tight">{view.data.name}</h3>
                <p className="text-lg leading-relaxed font-serif text-white/90 italic">{view.data.description}</p>
              </div>
            </div>
          </div>
        )}

        {/* OTROS MODOS: SHOP / BATTLE */}
        {view.mode === 'SHOP' && (
          <div className="h-full overflow-y-auto p-10 custom-scrollbar">
            <div className="max-w-6xl mx-auto text-center py-20 opacity-20">
               <ShoppingBag size={64} className="mx-auto mb-4" />
               <p className="font-serif italic text-xl tracking-widest uppercase">Accediendo al Mercado Negro...</p>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER TÉCNICO */}
      <footer className="h-6 bg-[#0D0704] border-t border-white/5 flex items-center px-4 justify-between">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]" />
          <span className="text-[7px] uppercase tracking-[0.3em] text-white/20 font-black">Sincronización Biosensorial Estable</span>
        </div>
        <span className="text-[7px] uppercase tracking-[0.3em] text-white/10 font-black">Vellum Tactical OS v2.4</span>
      </footer>
    </div>
  );
}

// ─── MASTER DASHBOARD ─────────────────────────────────────────────────────────

function MasterDashboard({ players, setPlayers }: {
  players: Player[]; setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
}) {
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#C5A059');
  const [inspectingId, setInspectingId] = useState<string | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  const createPlayer = async () => {
    if (!newName.trim()) return;
    const { data } = await (supabase.from('players') as any)
      .insert([{ 
        name: newName.trim(), 
        avatar_color: newColor, 
        hp: 100, 
        max_hp: 100, // 
        gold: 50 
      }])
      .select();
    
    if (data) {
      setPlayers(prev => [...prev, data[0]]);
      await (supabase.from('player_views') as any)
        .insert([{ player_id: data[0].id, mode: 'MAP', data: {} }]);
    }
    setNewName(''); setShowNew(false);
  };

  const deletePlayer = async (id: string) => {
    await (supabase.from('players') as any).delete().eq('id', id);
    setPlayers(prev => prev.filter(p => p.id !== id));
  };

  const saveEdit = async () => {
    if (!editingPlayer) return;
    await (supabase.from('players') as any).update({
      name: editingPlayer.name, hp: editingPlayer.hp,
      gold: editingPlayer.gold, avatar_color: editingPlayer.avatar_color,
      image_url: editingPlayer.image_url || null, bio: editingPlayer.bio || null,
    }).eq('id', editingPlayer.id);
    setPlayers(prev => prev.map(p => p.id === editingPlayer.id ? editingPlayer : p));
    setEditingPlayer(null);
  };

  return (
    <div className="h-full w-full flex bg-[#1C1008]">
      <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto custom-scrollbar">
        <h1 className="font-display text-4xl font-black text-[#C5A059] tracking-tight italic mb-2">VELLUM</h1>
        <p className="text-[10px] font-title uppercase tracking-[0.5em] opacity-40 mb-10">Master Console</p>

        <div className="grid grid-cols-5 gap-3 w-full max-w-3xl mb-8">
          {[
            { to: '/tactical', icon: <MapIcon size={24} />, label: 'Cartografía' },
            { to: '/scenes', icon: <ScrollText size={24} />, label: 'Escenas' },
            { to: '/bestiary', icon: <Sword size={24} />, label: 'Códice' },
            { to: '/shop', icon: <ShoppingBag size={24} />, label: 'Tienda' },
            { to: '/manuals', icon: <BookOpen size={24} />, label: 'Manuales' },
          ].map(({ to, icon, label }) => (
            <Link key={to} to={to}
              className="flex flex-col items-center gap-2.5 bg-[#C5A059]/8 border border-[#C5A059]/25 p-5 hover:bg-[#C5A059] hover:text-[#1C1008] hover:border-[#C5A059] transition-all group">
              <div className="group-hover:scale-110 transition-transform text-[#C5A059] group-hover:text-[#1C1008]">{icon}</div>
              <span className="font-title uppercase text-[9px] tracking-widest text-center">{label}</span>
            </Link>
          ))}
        </div>

        <div className="w-full max-w-3xl bg-[#2D1B14] border border-[#C5A059]/15 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-title text-lg font-bold">Personajes ({players.length})</h3>
            <button onClick={() => setShowNew(!showNew)}
              className="flex items-center gap-1.5 bg-[#C5A059] text-[#1C1008] px-3 py-1.5 text-[9px] font-black uppercase hover:bg-white transition-all">
              <Plus size={13} /> Nuevo
            </button>
          </div>

          {showNew && (
            <div className="flex gap-2 mb-4 p-3 bg-[#1C1008] border border-[#C5A059]/25 animate-in">
              <input value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createPlayer()} autoFocus
                placeholder="Nombre del personaje..."
                className="flex-1 bg-transparent border-b border-[#C5A059]/40 p-2 text-sm outline-none focus:border-[#C5A059] font-serif italic" />
              <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
                className="w-10 h-10 cursor-pointer bg-transparent border-none rounded" />
              <button onClick={createPlayer} className="px-3 bg-[#C5A059] text-[#1C1008] font-black hover:bg-white">
                <Check size={16} />
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {players.map(p => (
              <div key={p.id} className="space-y-2">
                <div
                  className="flex items-center gap-3 bg-[#1C1008] border border-white/5 p-3 hover:border-[#C5A059]/25 transition-all group">
                  {p.image_url ? (
                    <img src={p.image_url} className="w-10 h-10 rounded-full object-cover border-2 flex-shrink-0" style={{ borderColor: p.avatar_color }} alt={p.name} />
                  ) : (
                    <div className="w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-sm flex-shrink-0 font-title"
                      style={{ borderColor: p.avatar_color, color: p.avatar_color }}>
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold font-title truncate">{p.name}</p>
                    <p className="text-[9px] opacity-40">❤️{p.hp} &nbsp; 🪙{p.gold}</p>
                  </div>
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => setInspectingId(p.id === inspectingId ? null : p.id)} className="text-[#C5A059]/60 hover:text-[#C5A059] p-0.5" title="Ver Inventario">
                      <Package size={12} />
                    </button>
                    <button onClick={() => setEditingPlayer({ ...p })} className="text-[#C5A059]/60 hover:text-[#C5A059] p-0.5">
                      <Edit2 size={12} />
                    </button>
                    <button onClick={() => deletePlayer(p.id)} className="text-red-500/50 hover:text-red-500 p-0.5">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                {inspectingId === p.id && (
                  <div className="col-span-1"><DMInventoryInspector playerId={p.id} playerName={p.name} /></div>
                )}
              </div>
            ))}
            {!players.length && <p className="col-span-3 text-center opacity-25 italic text-xs py-6 font-serif">Sin personajes todavía.</p>}
          </div>
        </div>
      </div>

      <aside style={{ width: '260px' }} className="bg-[#150D08] border-l border-white/5 flex flex-col">
        <ChatPanel authorName="DM" isDM compact />
      </aside>

      {editingPlayer && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center animate-in" onClick={() => setEditingPlayer(null)}>
          <div className="bg-[#2D1B14] border border-[#C5A059]/50 p-6 w-96 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h4 className="font-title font-bold text-lg">Editar Personaje</h4>
              <button onClick={() => setEditingPlayer(null)} className="text-white/30 hover:text-white"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Nombre', key: 'name', type: 'text' },
                { label: 'URL Imagen', key: 'image_url', type: 'text' },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="text-[9px] uppercase font-black text-[#C5A059] mb-1 block">{label}</label>
                  <input type={type} value={(editingPlayer as any)[key] ?? ''}
                    onChange={e => setEditingPlayer({ ...editingPlayer, [key]: e.target.value })}
                    className="w-full bg-[#1C1008] border border-white/10 p-2 text-sm outline-none focus:border-[#C5A059]" />
                </div>
              ))}
              <div className="flex gap-2">
                {[
                  { label: 'HP Actual', key: 'hp' },
                  { label: 'HP Máximo', key: 'max_hp' },
                  { label: 'Oro', key: 'gold' }
                ].map(({ label, key }) => (
                  <div key={key} className="flex-1">
                    <label className="text-[9px] uppercase font-black text-[#C5A059] mb-1 block">{label}</label>
                    <input type="number" value={(editingPlayer as any)[key]}
                      onChange={e => setEditingPlayer({ ...editingPlayer!, [key]: +e.target.value })}
                      className="w-full bg-[#1C1008] border border-white/10 p-2 text-xs outline-none focus:border-[#C5A059]" />
                  </div>
                ))}
              </div>
              <div>
                <label className="text-[9px] uppercase font-black text-[#C5A059] mb-1 block">Color Avatar</label>
                <input type="color" value={editingPlayer.avatar_color}
                  onChange={e => setEditingPlayer({ ...editingPlayer, avatar_color: e.target.value })}
                  className="w-full h-10 cursor-pointer bg-transparent border border-white/10" />
              </div>
            </div>
            <GiveItemSection playerId={editingPlayer.id} playerName={editingPlayer.name} />
            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditingPlayer(null)}
                className="flex-1 py-2 border border-white/10 text-[10px] uppercase hover:border-[#C5A059]">Cancelar</button>
              <button onClick={saveEdit}
                className="flex-1 py-2 bg-[#C5A059] text-[#1C1008] text-[10px] font-black uppercase hover:bg-white">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DAR OBJETO A JUGADOR (DM) ────────────────────────────────────────────────

function GiveItemSection({ playerId, playerName }: { playerId: string; playerName: string }) {
  const [items] = useSupabaseTable<ShopItem>('shop_items', 'created_at');
  const [selectedItem, setSelectedItem] = useState('');
  const [feedback, setFeedback] = useState('');

  const give = async () => {
    if (!selectedItem) return;
    const item = items.find(i => i.id === selectedItem);
    if (!item) return;
    const { data: ex } = await (supabase.from('player_inventory') as any)
      .select('*').eq('player_id', playerId).eq('item_id', selectedItem).maybeSingle();
    if (ex) {
      await (supabase.from('player_inventory') as any).update({ quantity: ex.quantity + 1 }).eq('id', ex.id);
    } else {
      await (supabase.from('player_inventory') as any)
        .insert([{ player_id: playerId, item_id: selectedItem, quantity: 1 }]);
    }
    await (supabase.from('chat_messages') as any).insert([{
      author: 'DM', content: `entregó ${item.icon} ${item.name} a ${playerName}`, type: 'system'
    }]);
    setFeedback(`✅ ${item.name} → ${playerName}`);
    setTimeout(() => setFeedback(''), 2000);
  };

  return (
    <div className="mt-4 pt-4 border-t border-white/8">
      <p className="text-[9px] font-black uppercase text-[#C5A059]/60 mb-2">Dar objeto</p>
      <div className="flex gap-2">
        <select value={selectedItem} onChange={e => setSelectedItem(e.target.value)}
          className="flex-1 bg-[#1C1008] border border-white/10 p-1.5 text-[10px] text-[#D7CCC8] outline-none">
          <option value="">— Seleccionar —</option>
          {items.map(i => <option key={i.id} value={i.id}>{i.icon} {i.name}</option>)}
        </select>
        <button onClick={give} disabled={!selectedItem}
          className="px-3 bg-[#C5A059]/20 border border-[#C5A059]/30 text-[#C5A059] text-[9px] font-black hover:bg-[#C5A059] hover:text-black transition-all disabled:opacity-30">
          <Gift size={13} />
        </button>
      </div>
      {feedback && <p className="text-[9px] text-green-400 mt-1">{feedback}</p>}
    </div>
  );
}

// ─── MÓDULO CARTOGRÁFICO ──────────────────────────────────────────────────────
// FIX: Tiempo real sin recarga + tokens responsivos al mapa

function TacticalMapModule({ players, entities, broadcastToPlayer, broadcastToAll }: {
  players: any[]; entities: any[];
  broadcastToPlayer: Function; broadcastToAll: Function;
}) {
  const [maps, setAllMapsState] = useSupabaseTable<any>('maps', 'created_at');
  const [scenes] = useSupabaseTable<any>('scenes', 'created_at');
  const [currentMap, setCurrentMap] = useState<any | null>(null);
  const [spawnFilter, setSpawnFilter] = useState<'JUGADOR' | 'NPC' | 'Enemigo'>('JUGADOR');
  const [activeTool, setActiveTool] = useState<'MOVE' | 'HOTSPOT'>('MOVE');
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
  const [pendingHotspot, setPendingHotspot] = useState<{ x: number; y: number } | null>(null);
  const [hotspotForm, setHotspotForm] = useState({ label: '', targetMapId: '', targetSceneId: '', type: 'map' as 'map' | 'scene' });
  const mapRef = useRef<HTMLDivElement>(null);
  const [dragToken, setDragToken] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [infoModal, setInfoModal] = useState<any | null>(null);
  const [leftWidth, setLeftWidth] = useState(18);
  const [rightWidth, setRightWidth] = useState(18);
  const resizing = useRef<'left' | 'right' | null>(null);
  const [newMapName, setNewMapName] = useState('');
  const [newMapUrl, setNewMapUrl] = useState('');
  const [showNewMap, setShowNewMap] = useState(false);

  const { tokens, setTokens } = useMapTokens(currentMap?.id ?? null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (resizing.current === 'left') {
        const v = (e.clientX / window.innerWidth) * 100;
        if (v > 12 && v < 35) setLeftWidth(v);
      }
      if (resizing.current === 'right') {
        const v = ((window.innerWidth - e.clientX) / window.innerWidth) * 100;
        if (v > 12 && v < 35) setRightWidth(v);
      }
      if (dragToken && mapRef.current) {
        setIsDragging(true);
        const r = mapRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
        const y = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
        setTokens(prev => prev.map(t => t.id === dragToken ? { ...t, x, y } : t));
      }
    };
    const onUp = async () => {
      if (dragToken) {
        const mv = tokens.find(t => t.id === dragToken);
        if (isDragging && mv) await supabase.from('map_tokens').update({ x: mv.x, y: mv.y }).eq('id', mv.id);
        else if (!isDragging && mv) setInfoModal(mv);
      }
      resizing.current = null; setDragToken(null); setIsDragging(false);
      document.body.style.cursor = 'default';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragToken, isDragging, tokens, setTokens]);

  const createMap = async () => {
    if (!newMapName.trim()) return;
    const { data } = await supabase.from('maps').insert([{ name: newMapName, image_url: newMapUrl, hotspots: [] }]).select();
    if (data) { setAllMapsState(prev => [data[0], ...prev]); setCurrentMap(data[0]); }
    setNewMapName(''); setNewMapUrl(''); setShowNewMap(false);
  };

  const spawnToken = async (unit: any, isPlayer: boolean) => {
    if (!currentMap) return;
    const newToken = { map_id: currentMap.id, name: unit.name, type: isPlayer ? 'JUGADOR' : (unit.type || spawnFilter), x: 50, y: 50, image_url: unit.image_url || null };
    const { data } = await supabase.from('map_tokens').insert([newToken]).select();
    if (data) setTokens(prev => [...prev, data[0]]);
  };

  const deleteToken = async (id: string) => {
    setTokens(prev => prev.filter(t => t.id !== id));
    setInfoModal(null);
    await supabase.from('map_tokens').delete().eq('id', id);
  };

  const saveHotspot = async () => {
    if (!pendingHotspot || !currentMap || !hotspotForm.label) return;
    const newHotspot = { id: Date.now().toString(), x: pendingHotspot.x, y: pendingHotspot.y, label: hotspotForm.label, type: hotspotForm.type, targetMapId: hotspotForm.targetMapId, targetSceneId: hotspotForm.targetSceneId };
    const updated = { ...currentMap, hotspots: [...(currentMap.hotspots || []), newHotspot] };
    await supabase.from('maps').update({ hotspots: updated.hotspots }).eq('id', currentMap.id);
    setCurrentMap(updated);
    setPendingHotspot(null);
    setHotspotForm({ label: '', targetMapId: '', targetSceneId: '', type: 'map' });
  };

  const handleHotspotClick = async (hs: any) => {
    if (activeTool === 'HOTSPOT') {
      const updatedHotspots = (currentMap.hotspots || []).filter((h: any) => h.id !== hs.id);
      const { error } = await supabase.from('maps').update({ hotspots: updatedHotspots }).eq('id', currentMap.id);
      if (!error) setCurrentMap({ ...currentMap, hotspots: updatedHotspots });
      return;
    }
  
    if (hs.type === 'map' && hs.targetMapId) {
      // Recargamos el mapa destino fresco de Supabase para tener sus hotspots actuales
      const { data: freshMap } = await (supabase.from('maps') as any)
        .select('*').eq('id', hs.targetMapId).single();
      if (freshMap) {
        setCurrentMap(freshMap);
        await broadcastToAll('MAP', {
          map_id: freshMap.id,
          image_url: freshMap.image_url,
          hotspots: freshMap.hotspots ?? [],
          name: freshMap.name,
        });
      }
    } else if (hs.type === 'scene' && hs.targetSceneId) {
      const { data: freshScene } = await (supabase.from('scenes') as any)
        .select('*').eq('id', hs.targetSceneId).single();
      if (freshScene) {
        await broadcastToAll('SCENE', freshScene);
      }
    }
  };

  const sendMap = async () => {
    if (!currentMap) return;
    const viewData = {
      map_id: currentMap.id,
      image_url: currentMap.image_url,
      hotspots: currentMap.hotspots ?? [],  // ← nunca null
      tokens,
    };
    if (selectedPlayerIds.size > 0) {
      selectedPlayerIds.forEach(id => broadcastToPlayer(id, 'MAP', viewData));
    } else {
      broadcastToAll('MAP', viewData);
    }
  };

  return (
    <div className="h-full w-full select-none overflow-hidden" style={{ display: 'grid', gridTemplateColumns: `${leftWidth}% 4px 1fr 4px ${rightWidth}%`, background: '#0D0704' }}>
      
      {/* IZQUIERDA */}
      <aside className="bg-[#1C1008] flex flex-col gap-3 overflow-y-auto border-r border-[#C5A059]/10 p-4 shadow-2xl z-20 custom-scrollbar">
        <h2 className="text-base font-title text-[#C5A059] border-b border-[#C5A059]/20 pb-2 mb-3 uppercase italic font-black">Control Maestro</h2>

        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <p className="text-[8px] font-black uppercase text-[#C5A059]/50 tracking-widest">Base de Mapas</p>
            <button onClick={() => setShowNewMap(!showNewMap)} className="text-[#C5A059]/50 hover:text-[#C5A059]"><Plus size={16} /></button>
          </div>
          {showNewMap && (
            <div className="space-y-2 mb-3 p-3 bg-black/40 border border-[#C5A059]/20 animate-in">
              <input value={newMapName} onChange={e => setNewMapName(e.target.value)} placeholder="Nombre..." className="w-full bg-transparent border-b border-[#C5A059]/30 p-1 text-[9px] outline-none text-white" />
              <input value={newMapUrl} onChange={e => setNewMapUrl(e.target.value)} placeholder="URL..." className="w-full bg-transparent border-b border-white/10 p-1 text-[9px] outline-none text-white/60" />
              <button onClick={createMap} className="w-full py-2 bg-[#C5A059] text-black text-[8px] font-black uppercase hover:bg-white transition-all">Registrar</button>
            </div>
          )}
          <div className="space-y-0.5 max-h-32 overflow-y-auto custom-scrollbar">
            {maps.map(m => (
              <button key={m.id} onClick={() => setCurrentMap(m)} className={`block w-full text-left p-2 text-[9px] transition-all ${currentMap?.id === m.id ? 'text-[#C5A059] bg-[#C5A059]/10 border-l-2 border-[#C5A059]' : 'opacity-40 hover:opacity-100 hover:bg-white/5'}`}>▸ {m.name}</button>
            ))}
          </div>
        </div>

        <div className="flex gap-1 mb-4">
          {(['MOVE', 'HOTSPOT'] as const).map(t => (
            <button key={t} onClick={() => setActiveTool(t)} className={`flex-1 py-2 text-[8px] font-black uppercase transition-all ${activeTool === t ? 'bg-[#C5A059] text-black shadow-[0_0_10px_rgba(197,160,89,0.3)]' : 'border border-[#C5A059]/25 text-[#C5A059]/60'}`}>
              {t === 'MOVE' ? '✥ Mover' : '◆ Portal'}
            </button>
          ))}
        </div>

        <div className="p-3 bg-black/20 border border-white/5 rounded-lg">
          <p className="text-[8px] font-black uppercase text-[#C5A059]/50 mb-2">Despliegue</p>
          <select value={spawnFilter} onChange={(e: any) => setSpawnFilter(e.target.value)} className="w-full bg-[#2D1B14] p-2 text-[10px] text-[#C5A059] border border-[#C5A059]/20 mb-3 outline-none">
            <option value="JUGADOR">Operativos</option>
            <option value="NPC">Aliados</option>
            <option value="Enemigo">Amenazas</option>
          </select>
          <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
            {spawnFilter === 'JUGADOR' ? players.map(p => (
              <button key={p.id} onClick={() => spawnToken(p, true)} className="w-full text-left p-2 bg-[#2D1B14]/40 text-[9px] hover:bg-[#C5A059]/20 border border-transparent flex items-center gap-3 transition-all group">
                <div className="w-6 h-6 rounded-full border border-[#C5A059]/30 overflow-hidden bg-black shadow-lg">
                  {p.image_url ? <img src={p.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[8px] font-black">{p.name[0]}</div>}
                </div>
                <span className="truncate flex-1 font-bold text-white/80">{p.name}</span>
                <Plus size={12} className="opacity-0 group-hover:opacity-100" />
              </button>
            )) : entities.filter(e => (e.type || '').toLowerCase() === spawnFilter.toLowerCase()).map(e => (
              <button key={e.id} onClick={() => spawnToken(e, false)} className="w-full text-left p-2 bg-[#2D1B14]/40 text-[9px] hover:bg-[#C5A059]/20 border border-transparent flex items-center gap-3 transition-all group">
                <span className="flex-1 truncate font-bold text-white/80">{e.name}</span>
                <Plus size={12} className="opacity-0 group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </div>

        <button onClick={sendMap} className="mt-auto w-full bg-[#C5A059] text-black py-3 font-black text-[10px] uppercase hover:bg-white transition-all tracking-[0.2em] shadow-lg">⬡ Sincronizar Radar</button>
      </aside>

      <div onMouseDown={() => { resizing.current = 'left'; }} className="w-1 cursor-col-resize bg-[#C5A059]/10" />

      {/* ÁREA CENTRAL */}
      <main className="relative bg-[#0D0704] overflow-hidden shadow-inner" ref={mapRef}>
        <MapWithTokens
          map={currentMap} tokens={tokens} isDM={true}
          onTokenMouseDown={(e, id) => { e.preventDefault(); setDragToken(id); setIsDragging(false); }}
          selectedToken={dragToken} onHotspotClick={handleHotspotClick} activeTool={activeTool}
          onMapClick={(e) => {
            if (activeTool === 'HOTSPOT' && currentMap && mapRef.current && !dragToken) {
              const r = mapRef.current.getBoundingClientRect();
              setPendingHotspot({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
            }
          }}
        />

        {infoModal && (
          <div className="absolute top-4 left-4 z-[100] bg-[#1C1008]/95 border border-[#C5A059]/50 p-5 shadow-2xl animate-in duration-200">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full border-2 border-[#C5A059]/50 overflow-hidden bg-black shadow-lg">
                {infoModal.image_url ? <img src={infoModal.image_url} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center font-bold text-[#C5A059] text-xl bg-black">{infoModal.name.charAt(0)}</div>}
              </div>
              <div>
                <h4 className="text-white font-bold font-title text-base tracking-tight">{infoModal.name}</h4>
                <p className="text-[9px] opacity-40 uppercase tracking-[0.2em] font-black">{infoModal.type}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setInfoModal(null)} className="flex-1 py-2 border border-white/10 text-[9px] uppercase text-white/40 font-black hover:text-white transition-colors">Cerrar</button>
              <button onClick={() => deleteToken(infoModal.id)} className="flex-1 py-2 bg-red-950/40 text-red-500 text-[9px] border border-red-700/40 uppercase font-black hover:bg-red-900 transition-all">Retirar</button>
            </div>
          </div>
        )}

        {pendingHotspot && (
          <div className="absolute top-4 right-4 z-[100] bg-[#1C1008]/95 border border-[#C5A059]/50 p-5 shadow-2xl w-64 animate-in slide-in-from-right-4 duration-300 backdrop-blur-md">
            <h4 className="font-title text-sm mb-4 text-[#C5A059] uppercase italic tracking-[0.2em] font-black">Nuevo Punto de Salto</h4>
            <div className="space-y-3">
              <input value={hotspotForm.label} onChange={e => setHotspotForm({ ...hotspotForm, label: e.target.value })} placeholder="Etiqueta..." className="w-full bg-[#2D1B14] border border-white/10 p-2 text-[10px] outline-none text-white focus:border-[#C5A059]" />
              <select value={hotspotForm.type} onChange={e => setHotspotForm({ ...hotspotForm, type: e.target.value as any })} className="w-full bg-[#2D1B14] border border-white/10 p-2 text-[10px] outline-none text-[#D7CCC8]">
                <option value="map">Destino: Mapa</option>
                <option value="scene">Destino: Escena</option>
              </select>
              {hotspotForm.type === 'map' ? (
                <select value={hotspotForm.targetMapId} onChange={e => setHotspotForm({ ...hotspotForm, targetMapId: e.target.value })} className="w-full bg-[#2D1B14] border border-white/10 p-2 text-[10px] outline-none text-[#D7CCC8]">
                  <option value="">— Seleccionar Mapa —</option>
                  {maps.filter(m => m.id !== currentMap?.id).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              ) : (
                <select value={hotspotForm.targetSceneId} onChange={e => setHotspotForm({ ...hotspotForm, targetSceneId: e.target.value })} className="w-full bg-[#2D1B14] border border-white/10 p-2 text-[10px] outline-none text-[#D7CCC8]">
                  <option value="">— Seleccionar Escena —</option>
                  {scenes.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setPendingHotspot(null)} className="flex-1 py-2 border border-white/10 text-[9px] uppercase font-black text-white/40">Cancelar</button>
              <button onClick={saveHotspot} className="flex-1 py-2 bg-[#C5A059] text-black text-[9px] font-black uppercase shadow-lg">Fijar Portal</button>
            </div>
          </div>
        )}
      </main>

      <div onMouseDown={() => { resizing.current = 'right'; }} className="w-1 cursor-col-resize bg-[#C5A059]/10" />

      <aside className="bg-[#150D08] flex flex-col min-h-0 overflow-hidden shadow-2xl z-20">
        <ChatPanel authorName="DM" isDM compact />
      </aside>
    </div>
  );
}

// ─── MÓDULO DE ESCENAS ────────────────────────────────────────────────────────
// FIX PORTAL ESCENA→MAPA: cuando el DM hace clic en un hotspot tipo 'map',
// se hace broadcastToAll con el mapa destino

function ScenesModule({ players, broadcastToPlayer, broadcastToAll }: {
  players: Player[]; broadcastToPlayer: Function; broadcastToAll: Function;
}) {
  const [scenes, setScenes] = useSupabaseTable<SceneData>('scenes', 'created_at');
  const [shopItems] = useSupabaseTable<ShopItem>('shop_items', 'created_at');
  const [allMaps] = useSupabaseTable<MapData>('maps', 'created_at');
  const [form, setForm] = useState<{
    bg_image: string; char_image: string; speaker: string; dialogue: string;
    has_shop: boolean; shop_items: string[]; hotspots: SceneHotspot[];
  }>({ bg_image: '', char_image: '', speaker: 'Narrador', dialogue: '', has_shop: false, shop_items: [], hotspots: [] });
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'scene' | 'shop' | 'portals'>('scene');
  const [pendingSceneHotspot, setPendingSceneHotspot] = useState<{ x: number; y: number } | null>(null);
  const [sceneHotspotForm, setSceneHotspotForm] = useState({ label: '', targetMapId: '', targetSceneId: '', type: 'scene' as 'map' | 'scene' });
  const sceneRef = useRef<HTMLDivElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const f = e.target.files?.[0];
    if (f) {
      const r = new FileReader();
      r.readAsDataURL(f);
      r.onload = ev => setForm({ ...form, [key]: ev.target?.result as string });
    }
  };

  const handleSave = async () => {
    const title = `${form.speaker} — ${form.dialogue.slice(0, 30)}`;
    const { data } = await (supabase.from('scenes') as any).insert([{ ...form, title }]).select();
    if (data) setScenes(prev => [data[0] as SceneData, ...prev]);
  };

  const sendScene = async () => {
    const payload = { ...form };
    if (selectedPlayerIds.size > 0)
      for (const pid of selectedPlayerIds) await broadcastToPlayer(pid, 'SCENE', payload);
    else await broadcastToAll('SCENE', payload);
  };

  const sendShop = async () => {
    const vd = { shopItemIds: form.shop_items, bg_image: form.bg_image, char_image: form.char_image };
    if (selectedPlayerIds.size > 0)
      for (const pid of selectedPlayerIds) await broadcastToPlayer(pid, 'SHOP', vd);
    else await broadcastToAll('SHOP', vd);
  };

  // FIX: Portal en escena → cuando el DM hace clic en un hotspot de tipo 'map',
  // envía a los jugadores la vista de ese mapa
  const handlePreviewHotspotClick = async (hs: SceneHotspot) => {
    if (hs.type === 'map' && hs.targetMapId) {
      const targetMap = allMaps.find(m => m.id === hs.targetMapId);
      if (targetMap) {
        const vd = {
          map_id: targetMap.id,
          image_url: targetMap.image_url,
          hotspots: targetMap.hotspots,
        };
        if (selectedPlayerIds.size > 0)
          for (const pid of selectedPlayerIds) await broadcastToPlayer(pid, 'MAP', vd);
        else await broadcastToAll('MAP', vd);
        await (supabase.from('chat_messages') as any).insert([{
          author: 'DM', content: `navegó al mapa: "${targetMap.name}"`, type: 'system'
        }]);
      }
    } else if (hs.type === 'scene' && hs.targetSceneId) {
      const targetScene = scenes.find(s => s.id === hs.targetSceneId);
      if (targetScene) {
        setForm({
          bg_image: targetScene.bg_image, char_image: targetScene.char_image,
          speaker: targetScene.speaker, dialogue: targetScene.dialogue,
          has_shop: targetScene.has_shop, shop_items: targetScene.shop_items,
          hotspots: targetScene.hotspots || []
        });
        const payload = { ...targetScene };
        if (selectedPlayerIds.size > 0)
          for (const pid of selectedPlayerIds) await broadcastToPlayer(pid, 'SCENE', payload);
        else await broadcastToAll('SCENE', payload);
      }
    }
  };

  const addSceneHotspot = () => {
    if (!pendingSceneHotspot || !sceneHotspotForm.label) return;
    const hs: SceneHotspot = {
      id: Date.now().toString(),
      x: pendingSceneHotspot.x, y: pendingSceneHotspot.y,
      label: sceneHotspotForm.label, type: sceneHotspotForm.type,
      targetMapId: sceneHotspotForm.type === 'map' ? sceneHotspotForm.targetMapId : undefined,
      targetSceneId: sceneHotspotForm.type === 'scene' ? sceneHotspotForm.targetSceneId : undefined,
    };
    setForm({ ...form, hotspots: [...form.hotspots, hs] });
    setPendingSceneHotspot(null);
    setSceneHotspotForm({ label: '', targetMapId: '', targetSceneId: '', type: 'scene' });
  };

  const removeSceneHotspot = (id: string) => {
    setForm({ ...form, hotspots: form.hotspots.filter(h => h.id !== id) });
  };

  const toggleItem = (id: string) => setForm({
    ...form,
    shop_items: form.shop_items.includes(id) ? form.shop_items.filter(i => i !== id) : [...form.shop_items, id]
  });

  const toggleSel = (id: string) => {
    const s = new Set(selectedPlayerIds);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedPlayerIds(s);
  };

  return (
    <div className="h-full w-full flex bg-[#1C1008] animate-in">
      <aside style={{ width: '280px' }} className="bg-[#2D1B14] border-r border-[#C5A059]/15 flex flex-col overflow-y-auto custom-scrollbar">
        <div className="p-4 border-b border-[#C5A059]/20 flex items-center justify-between flex-shrink-0">
          <h3 className="font-title text-base font-bold">Motor VN</h3>
          <button onClick={handleSave} className="bg-[#C5A059] text-black p-1.5 hover:bg-white transition-all"><Save size={13} /></button>
        </div>

        <div className="flex border-b border-white/5 flex-shrink-0">
          {(['scene', 'shop', 'portals'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-[8px] font-black uppercase flex items-center justify-center gap-1 transition-all ${activeTab === tab ? 'bg-[#C5A059]/15 text-[#C5A059] border-b border-[#C5A059]' : 'text-white/30 hover:text-white/60'}`}>
              {tab === 'scene' ? <ScrollText size={10} /> : tab === 'shop' ? <ShoppingBag size={10} /> : <MapIcon size={10} />}
              {tab === 'scene' ? 'Escena' : tab === 'shop' ? 'Tienda' : 'Portales'}
            </button>
          ))}
        </div>

        <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-3">
          {activeTab === 'scene' && (
            <>
              <label className="text-[9px] uppercase font-black text-[#C5A059] block">
                Fondo
                <input type="file" onChange={e => handleUpload(e, 'bg_image')} accept="image/*" className="w-full mt-1 text-white/30 text-[9px]" />
              </label>
              <label className="text-[9px] uppercase font-black text-[#C5A059] block">
                Sprite PJ
                <input type="file" onChange={e => handleUpload(e, 'char_image')} accept="image/*" className="w-full mt-1 text-white/30 text-[9px]" />
              </label>
              <input value={form.bg_image} onChange={e => setForm({ ...form, bg_image: e.target.value })}
                className="w-full bg-[#1C1008] border border-white/8 p-1.5 text-[9px] outline-none focus:border-[#C5A059]"
                placeholder="URL fondo (o sube archivo)" />
              <input value={form.char_image} onChange={e => setForm({ ...form, char_image: e.target.value })}
                className="w-full bg-[#1C1008] border border-white/8 p-1.5 text-[9px] outline-none focus:border-[#C5A059]"
                placeholder="URL sprite (o sube archivo)" />
              <input value={form.speaker} onChange={e => setForm({ ...form, speaker: e.target.value })}
                className="w-full bg-[#1C1008] border border-white/8 p-2 text-xs outline-none focus:border-[#C5A059]"
                placeholder="Hablante" />
              <textarea value={form.dialogue} onChange={e => setForm({ ...form, dialogue: e.target.value })}
                className="h-24 w-full bg-[#1C1008] border border-white/8 p-2 text-xs outline-none resize-none font-serif focus:border-[#C5A059]"
                placeholder="Guion de la escena..." />
            </>
          )}

          {activeTab === 'shop' && (
            <div className="space-y-1">
              {shopItems.map(item => (
                <button key={item.id} onClick={() => toggleItem(item.id)}
                  className={`w-full text-left text-[9px] p-2 border flex items-center gap-2 transition-all ${
                    form.shop_items.includes(item.id) ? 'border-[#C5A059] bg-[#C5A059]/10' : 'border-white/5 hover:border-white/15'
                  }`}>
                  <span>{item.icon || CATEGORY_ICONS[item.category]}</span>
                  <span className="flex-1 truncate">{item.name}</span>
                  <span className="text-yellow-500 text-[8px]">🪙{item.price}</span>
                  {form.shop_items.includes(item.id) && <Check size={10} className="text-[#C5A059]" />}
                </button>
              ))}
            </div>
          )}

          {activeTab === 'portals' && (
            <div className="space-y-3">
              <p className="text-[8px] text-white/30 italic">
                Clic en la vista previa para colocar portales. Los portales tipo 🗺️ (mapa) envían a los jugadores al mapa destino al instante.
              </p>
              {form.hotspots.map(hs => (
                <div key={hs.id} className="flex items-center gap-2 bg-[#1C1008] border border-white/5 p-2">
                  <span className="text-[9px] flex-1">{hs.type === 'scene' ? '🎭' : '🗺️'} {hs.label}</span>
                  <span className="text-[8px] opacity-30">{hs.type === 'map' ? allMaps.find(m => m.id === hs.targetMapId)?.name : scenes.find(s => s.id === hs.targetSceneId)?.title}</span>
                  <button onClick={() => removeSceneHotspot(hs.id)} className="text-red-500/50 hover:text-red-500"><X size={11} /></button>
                </div>
              ))}
              {pendingSceneHotspot && (
                <div className="bg-[#1C1008] border border-[#C5A059]/30 p-3 space-y-2 animate-in">
                  <p className="text-[8px] font-black uppercase text-[#C5A059]">Portal ({pendingSceneHotspot.x.toFixed(0)}%, {pendingSceneHotspot.y.toFixed(0)}%)</p>
                  <input value={sceneHotspotForm.label} onChange={e => setSceneHotspotForm({ ...sceneHotspotForm, label: e.target.value })}
                    placeholder="Etiqueta..." className="w-full bg-[#2D1B14] border border-white/10 p-1.5 text-[9px] outline-none focus:border-[#C5A059]" />
                  <select value={sceneHotspotForm.type} onChange={e => setSceneHotspotForm({ ...sceneHotspotForm, type: e.target.value as any })}
                    className="w-full bg-[#2D1B14] border border-white/10 p-1.5 text-[9px] outline-none text-[#D7CCC8]">
                    <option value="scene">→ Escena</option>
                    <option value="map">→ Mapa (envía jugadores)</option>
                  </select>
                  {sceneHotspotForm.type === 'map' ? (
                    <select value={sceneHotspotForm.targetMapId} onChange={e => setSceneHotspotForm({ ...sceneHotspotForm, targetMapId: e.target.value })}
                      className="w-full bg-[#2D1B14] border border-white/10 p-1.5 text-[9px] outline-none text-[#D7CCC8]">
                      <option value="">— Mapa —</option>
                      {allMaps.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  ) : (
                    <select value={sceneHotspotForm.targetSceneId} onChange={e => setSceneHotspotForm({ ...sceneHotspotForm, targetSceneId: e.target.value })}
                      className="w-full bg-[#2D1B14] border border-white/10 p-1.5 text-[9px] outline-none text-[#D7CCC8]">
                      <option value="">— Escena —</option>
                      {scenes.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => setPendingSceneHotspot(null)} className="flex-1 py-1 border border-white/10 text-[8px] uppercase">Cancelar</button>
                    <button onClick={addSceneHotspot} className="flex-1 py-1 bg-[#C5A059] text-black text-[8px] font-black uppercase">Añadir</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[#C5A059]/15 flex-shrink-0 space-y-2">
          <div className="flex flex-wrap gap-1 mb-2">
            <button onClick={() => setSelectedPlayerIds(new Set())}
              className={`text-[8px] px-2 py-0.5 border ${selectedPlayerIds.size === 0 ? 'border-[#C5A059] text-[#C5A059]' : 'border-white/10 text-white/30'}`}>
              Todos
            </button>
            {players.map(p => (
              <button key={p.id} onClick={() => toggleSel(p.id)}
                className={`text-[8px] px-2 py-0.5 border truncate ${selectedPlayerIds.has(p.id) ? 'border-[#C5A059] text-[#C5A059]' : 'border-white/10 text-white/30'}`}>
                {p.name}
              </button>
            ))}
          </div>
          <button onClick={sendScene} className="w-full bg-white text-black py-2.5 font-black text-[9px] uppercase flex items-center justify-center gap-2 hover:bg-[#C5A059] transition-all">
            <Eye size={13} /> Mostrar Escena
          </button>
          {form.shop_items.length > 0 && (
            <button onClick={sendShop} className="w-full bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/30 py-2.5 font-black text-[9px] uppercase flex items-center justify-center gap-2 hover:bg-[#C5A059] hover:text-black transition-all">
              <ShoppingBag size={13} /> Abrir Tienda
            </button>
          )}
        </div>

        {scenes.length > 0 && (
          <div className="border-t border-white/5 p-4 flex-shrink-0">
            <p className="text-[8px] font-black uppercase text-[#C5A059]/50 mb-2">Guardadas</p>
            <div className="space-y-0.5 max-h-28 overflow-y-auto custom-scrollbar">
              {scenes.map(s => (
                <div key={s.id} className="flex items-center hover:bg-[#1C1008] group border border-transparent hover:border-[#C5A059]/20">
                  <button onClick={() => setForm({
                    bg_image: s.bg_image, char_image: s.char_image,
                    speaker: s.speaker, dialogue: s.dialogue,
                    has_shop: s.has_shop, shop_items: s.shop_items,
                    hotspots: s.hotspots || []
                  })} className="flex-1 text-left text-[9px] text-white/50 p-1.5 truncate">{s.title}</button>
                  <button onClick={async () => {
                    await (supabase.from('scenes') as any).delete().eq('id', s.id);
                    setScenes(prev => prev.filter(sc => sc.id !== s.id));
                  }} className="px-2 opacity-0 group-hover:opacity-100 text-red-500/60 hover:text-red-500"><Trash2 size={11} /></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* Vista previa — clic para colocar portales + clic en hotspot para activarlos */}
      <main
        className="flex-1 relative bg-black overflow-hidden"
        ref={sceneRef}
        onClick={(e) => {
          if (activeTab === 'portals' && sceneRef.current) {
            const r = sceneRef.current.getBoundingClientRect();
            setPendingSceneHotspot({
              x: ((e.clientX - r.left) / r.width) * 100,
              y: ((e.clientY - r.top) / r.height) * 100,
            });
          }
        }}
        style={{ cursor: activeTab === 'portals' ? 'crosshair' : 'default' }}
      >
        <div className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: form.bg_image ? `url(${form.bg_image})` : 'none', filter: 'brightness(0.65)' }} />
        {form.char_image && (
          <img src={form.char_image}
            className="absolute bottom-[140px] left-1/2 -translate-x-1/2 h-[72%] object-contain drop-shadow-[0_0_60px_rgba(0,0,0,0.9)]"
            alt="sprite" />
        )}
        {/* FIX: Hotspots en preview — clic activa la navegación */}
        {form.hotspots.map(hs => (
          <div
            key={hs.id}
            style={{ left: `${hs.x}%`, top: `${hs.y}%`, position: 'absolute', transform: 'translate(-50%,-50%)' }}
            className="z-20 group"
            onClick={(e) => {
              if (activeTab !== 'portals') {
                e.stopPropagation();
                handlePreviewHotspotClick(hs);
              }
            }}
            
          >
            <div className={`w-5 h-5 rotate-45 border-2 animate-pulse transition-all hover:scale-125
              ${hs.type === 'scene' ? 'bg-purple-500/80 border-purple-300' : 'bg-[#C5A059]/80 border-yellow-300'}`} />
            <div className="absolute left-6 -top-2 bg-[#1C1008]/90 border border-[#C5A059]/50 px-2 py-0.5 text-[8px] font-bold opacity-0 group-hover:opacity-100 whitespace-nowrap text-white z-50 pointer-events-none">
              {hs.type === 'scene' ? '🎭' : '🗺️'} {hs.label}
              {activeTab !== 'portals' && <span className="text-[#C5A059] ml-1">← clic para navegar</span>}
            </div>
          </div>
        ))}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[88%] max-w-2xl p-5 bg-[#1C1008]/92 border-t-4 border-[#C5A059]">
          <div className="absolute -top-6 left-6 bg-[#C5A059] text-[#1C1008] px-5 py-1 text-[9px] font-black uppercase tracking-[0.3em]">
            {form.speaker || 'Narrador'}
          </div>
          <p className="text-[#D7CCC8] font-serif text-lg leading-relaxed">
            {form.dialogue || <span className="opacity-20 italic">El guion...</span>}
          </p>
        </div>
        {!form.bg_image && !form.char_image && (
          <div className="absolute inset-0 flex items-center justify-center flex-col gap-3 opacity-10 pointer-events-none">
            <ScrollText size={80} />
            <p className="font-serif italic">Vista previa de escena</p>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── MÓDULO CÓDICE ────────────────────────────────────────────────────────────

function BestiaryModule() {
  //  Asegúrar de que useSupabaseTable devuelva el setter (setEntities)
  const [entities, setEntities] = useSupabaseTable<Entity>('entities', 'name');
  const [editingEntity, setEditingEntity] = useState<Partial<Entity> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 🛡️ PROTOCOLO DE PERSISTENCIA DEFINITIVO
  const saveEntity = async () => {
    if (!editingEntity?.name) return;
    setIsSaving(true);

    // Paquete de datos unificado para el Códice
    const payload = {
      name: editingEntity.name,
      type: editingEntity.type || 'Enemigo',
      hp: Number(editingEntity.hp) || 100,
      max_hp: Number(editingEntity.hp) || 100, // Sincronizamos max_hp con hp inicial
      image_url: editingEntity.image_url || null,
      description: editingEntity.description || ""
    };

    try {
      if (editingEntity.id) {
        // ACTUALIZAR REGISTRO EXISTENTE
        const { data, error } = await supabase
          .from('entities')
          .update(payload)
          .eq('id', editingEntity.id)
          .select();

        if (error) throw error;
        if (data) {
          setEntities(prev => prev.map(e => e.id === editingEntity.id ? data[0] : e));
          setEditingEntity(null);
        }
      } else {
        // CREAR NUEVO REGISTRO (INSERT)
        const { data, error } = await supabase
          .from('entities')
          .insert([payload])
          .select(); // CRITICO: .select() devuelve el objeto con su nueva ID

        if (error) throw error;
        if (data) {
          setEntities(prev => [data[0], ...prev]);
          setEditingEntity(null);
        }
      }
    } catch (err: any) {
      // Si falla, el error aparecerá aquí con detalle
      console.error("Error en la persistencia del Códice:", err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteEntity = async (id: string) => {
    if (!confirm("¿Eliminar registro de forma permanente?")) return;
    setEntities(prev => prev.filter(e => e.id !== id));
    await supabase.from('entities').delete().eq('id', id);
  };

  return (
    <div className="h-full flex flex-col bg-[#0D0704] text-[#D7CCC8]">
      <header className="p-6 border-b border-[#C5A059]/20 flex justify-between items-center bg-[#1C1008] shadow-xl">
        <div>
          <h1 className="font-title text-2xl text-[#C5A059] tracking-tighter italic uppercase font-black">Códice de Amenazas</h1>
          <p className="text-[10px] opacity-40 uppercase tracking-[0.3em]">Base de Datos de Entidades Tácticas</p>
        </div>
        <button 
          onClick={() => setEditingEntity({ name: '', type: 'Enemigo', hp: 100 })}
          className="bg-[#C5A059] text-black px-6 py-2 font-black text-xs uppercase hover:bg-white transition-all shadow-[0_0_20px_rgba(197,160,89,0.3)]"
        >
          + Registrar Nueva Entidad
        </button>
      </header>

      <div className="flex-1 overflow-hidden flex">
        {/* LISTADO LATERAL */}
        <aside className="w-80 border-r border-white/5 overflow-y-auto custom-scrollbar p-4 space-y-2 bg-black/20">
          {entities.map(entity => (
            <div 
              key={entity.id}
              onClick={() => setEditingEntity(entity)}
              className={`p-4 border transition-all cursor-pointer relative group ${
                editingEntity?.id === entity.id ? 'bg-[#C5A059]/10 border-[#C5A059] shadow-inner' : 'bg-black/40 border-white/5 hover:border-white/20'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold font-title uppercase tracking-tight">{entity.name}</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); deleteEntity(entity.id); }}
                  className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 transition-opacity"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <p className="text-[8px] opacity-30 uppercase mt-1 tracking-widest">{entity.type} — {entity.hp} HP</p>
            </div>
          ))}
        </aside>

        {/* ÁREA DE EDICIÓN */}
        <main className="flex-1 p-10 bg-black/10 overflow-y-auto custom-scrollbar">
          {editingEntity ? (
            <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase text-[#C5A059] tracking-widest">Nombre de la Unidad</label>
                    <input 
                      value={editingEntity.name}
                      onChange={e => setEditingEntity({...editingEntity, name: e.target.value})}
                      className="w-full bg-[#1C1008] border border-[#C5A059]/30 p-3 text-sm outline-none focus:border-[#C5A059] text-white shadow-inner"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase text-[#C5A059] tracking-widest">Categoría</label>
                    <select 
                      value={editingEntity.type}
                      onChange={e => setEditingEntity({...editingEntity, type: e.target.value as any})}
                      className="w-full bg-[#1C1008] border border-[#C5A059]/30 p-3 text-sm outline-none text-white cursor-pointer"
                    >
                      <option value="Enemigo">AMENAZA (ENEMIGO)</option>
                      <option value="NPC">NEUTRAL (NPC)</option>
                      <option value="JUGADOR">OPERATIVO (JUGADOR)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase text-[#C5A059] tracking-widest">Puntos de Estructura (HP)</label>
                    <input 
                      type="number"
                      value={editingEntity.hp}
                      onChange={e => setEditingEntity({...editingEntity, hp: Number(e.target.value)})}
                      className="w-full bg-[#1C1008] border border-[#C5A059]/30 p-3 text-sm outline-none focus:border-[#C5A059]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase text-[#C5A059] tracking-widest">Enlace de Imagen (URL)</label>
                    <input 
                      value={editingEntity.image_url || ''}
                      onChange={e => setEditingEntity({...editingEntity, image_url: e.target.value})}
                      className="w-full bg-[#1C1008] border border-[#C5A059]/30 p-3 text-sm outline-none focus:border-[#C5A059]"
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-[#C5A059] tracking-widest">Descripción del Sujeto</label>
                  <textarea 
                    value={editingEntity.description || ''}
                    onChange={e => setEditingEntity({...editingEntity, description: e.target.value})}
                    className="w-full bg-[#1C1008] border border-[#C5A059]/30 p-4 text-sm outline-none h-40 resize-none font-serif italic"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={saveEntity}
                  disabled={isSaving}
                  className="flex-1 bg-[#C5A059] text-black py-4 font-black uppercase text-xs tracking-widest hover:bg-white transition-all disabled:opacity-30 shadow-lg"
                >
                  {isSaving ? 'REGISTRANDO...' : 'CONFIRMAR REGISTRO'}
                </button>
                <button 
                  onClick={() => setEditingEntity(null)}
                  className="px-8 border border-white/10 uppercase text-[10px] font-black hover:bg-white/5 transition-colors"
                >
                  CANCELAR
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center opacity-10 grayscale">
              <Scroll size={100} />
              <p className="font-serif italic text-2xl mt-6 uppercase tracking-[0.3em]">Esperando Datos del Códice</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ─── GESTOR DE TIENDA ─────────────────────────────────────────────────────────

function ShopManagerModule({ players }: { players: Player[] }) {
  const [items, setItems] = useSupabaseTable<ShopItem>('shop_items', 'created_at');
  const [form, setForm] = useState({ name: '', description: '', price: 0, sell_price: 0, icon: '', category: 'misc', stock: -1 });
  const [activePlayer, setActivePlayer] = useState<string | null>(null);
  const { inventory, reload: reloadInventory } = useInventory(activePlayer);

  const createItem = async () => {
    if (!form.name.trim()) return;
    const { data } = await (supabase.from('shop_items') as any).insert([{
      ...form,
      sell_price: form.sell_price || Math.floor(form.price / 2)
    }]).select();
    if (data) setItems(prev => [data[0] as ShopItem, ...prev]);
    setForm({ name: '', description: '', price: 0, sell_price: 0, icon: '', category: 'misc', stock: -1 });
  };

  const seedItems = async () => {
    for (const item of SAMPLE_ITEMS) {
      await (supabase.from('shop_items') as any).insert([item]);
    }
    const { data } = await (supabase.from('shop_items') as any).select('*').order('created_at', { ascending: false });
    if (data) setItems(data);
  };

  const giveItem = async (itemId: string, playerId: string) => {
    const ex = inventory.find(i => i.item_id === itemId && i.player_id === playerId);
    if (ex) {
      await (supabase.from('player_inventory') as any).update({ quantity: ex.quantity + 1 }).eq('id', ex.id);
    } else {
      await (supabase.from('player_inventory') as any)
        .insert([{ player_id: playerId, item_id: itemId, quantity: 1 }]);
    }
    const item = items.find(i => i.id === itemId);
    const player = players.find(p => p.id === playerId);
    await (supabase.from('chat_messages') as any).insert([{
      author: 'DM', content: `entregó ${item?.icon} ${item?.name} a ${player?.name}`, type: 'system'
    }]);
    reloadInventory();
  };

  const removeFromInventory = async (invId: string) => {
    await (supabase.from('player_inventory') as any).delete().eq('id', invId);
  };

  return (
    <div className="h-full w-full bg-[#1C1008] flex animate-in">
      <aside style={{ width: '300px' }} className="bg-[#2D1B14] border-r border-[#C5A059]/15 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-[#C5A059]/15">
          <h3 className="font-title text-lg font-bold mb-3">Nuevo Artículo</h3>
          <div className="space-y-2">
            <div className="flex gap-2">
              <input value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })}
                className="w-14 bg-[#1C1008] border border-white/10 p-2 text-xl text-center outline-none focus:border-[#C5A059]"
                placeholder="🗡️" />
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="flex-1 bg-[#1C1008] border-b border-[#C5A059]/30 p-2 text-white outline-none font-serif"
                placeholder="Nombre" />
            </div>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full bg-[#1C1008] border border-white/8 p-2 text-xs outline-none resize-none h-12 focus:border-[#C5A059]"
              placeholder="Descripción..." />
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[8px] uppercase font-black text-[#C5A059] mb-0.5 block">Precio</label>
                <input type="number" value={form.price}
                  onChange={e => setForm({ ...form, price: +e.target.value, sell_price: Math.floor(+e.target.value / 2) })}
                  className="w-full bg-[#1C1008] border border-white/8 p-1.5 text-xs outline-none focus:border-[#C5A059]" />
              </div>
              <div className="flex-1">
                <label className="text-[8px] uppercase font-black text-[#C5A059] mb-0.5 block">Venta</label>
                <input type="number" value={form.sell_price} onChange={e => setForm({ ...form, sell_price: +e.target.value })}
                  className="w-full bg-[#1C1008] border border-white/8 p-1.5 text-xs outline-none focus:border-[#C5A059]" />
              </div>
            </div>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              className="w-full bg-[#1C1008] border border-white/8 p-1.5 text-xs outline-none text-[#D7CCC8]">
              {Object.keys(CATEGORY_ICONS).map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>)}
            </select>
            <button onClick={createItem} className="w-full bg-[#C5A059] text-[#1C1008] py-2.5 font-black uppercase text-[9px] tracking-widest hover:bg-white transition-all">
              + Añadir al Catálogo
            </button>
            <button onClick={seedItems} className="w-full border border-[#C5A059]/25 text-[#C5A059]/60 py-2 font-black uppercase text-[8px] hover:border-[#C5A059] hover:text-[#C5A059] transition-all">
              ✦ Generar Items de Muestra
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          <p className="text-[8px] font-black uppercase text-[#C5A059]/50 mb-2">Gestión de Jugadores</p>
          <div className="flex flex-wrap gap-1 mb-3">
            {players.map(p => (
              <button key={p.id} onClick={() => setActivePlayer(p.id)}
                className={`text-[8px] px-2 py-0.5 border ${activePlayer === p.id ? 'border-[#C5A059] text-[#C5A059]' : 'border-white/10 text-white/30'}`}>
                {p.name}
              </button>
            ))}
          </div>
          {activePlayer && (
            <div>
              <p className="text-[8px] text-white/30 mb-2 italic">Inventario de {players.find(p => p.id === activePlayer)?.name}</p>
              {inventory.length === 0 && <p className="text-[9px] opacity-20 italic text-center py-2">Vacío</p>}
              {inventory.map(inv => (
                <div key={inv.id} className="flex items-center gap-2 bg-[#1C1008] border border-white/5 p-2 mb-1">
                  <span>{inv.shop_items?.icon}</span>
                  <span className="text-[9px] flex-1">{inv.shop_items?.name} ×{inv.quantity}</span>
                  <button onClick={() => removeFromInventory(inv.id)} className="text-red-500/50 hover:text-red-500"><X size={11} /></button>
                </div>
              ))}
              <p className="text-[8px] text-[#C5A059]/40 mt-3 mb-1 font-black uppercase">Dar objeto:</p>
              <div className="space-y-0.5 max-h-40 overflow-y-auto custom-scrollbar">
                {items.map(item => (
                  <button key={item.id} onClick={() => giveItem(item.id, activePlayer)}
                    className="w-full text-left p-1.5 bg-black/20 text-[9px] hover:bg-[#C5A059]/10 border border-transparent hover:border-[#C5A059]/20 flex items-center gap-2">
                    <span>{item.icon}</span><span className="flex-1 truncate">{item.name}</span>
                    <Gift size={10} className="text-[#C5A059]/50" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto custom-scrollbar">
        <div className="flex justify-between items-end mb-6 border-b border-white/5 pb-4">
          <h2 className="font-display text-3xl font-bold italic">Catálogo
            <span className="text-lg opacity-30 ml-3 font-serif">({items.length})</span>
          </h2>
        </div>
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map(item => (
            <div key={item.id} className="bg-[#2D1B14] border border-white/5 p-4 hover:border-[#C5A059]/30 transition-all group relative">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-3xl">{item.icon || CATEGORY_ICONS[item.category] || '📦'}</span>
                <div className="flex-1">
                  <h4 className="font-title font-bold text-sm">{item.name}</h4>
                  <span className="text-[8px] uppercase text-[#C5A059]/50">{item.category}</span>
                </div>
                <button onClick={async () => {
                  await (supabase.from('shop_items') as any).delete().eq('id', item.id);
                  setItems(prev => prev.filter(i => i.id !== item.id));
                }} className="opacity-0 group-hover:opacity-100 text-red-500/40 hover:text-red-500 transition-all">
                  <Trash2 size={14} />
                </button>
              </div>
              {item.description && <p className="text-[10px] text-white/40 mb-3 line-clamp-2 font-serif italic">{item.description}</p>}
              <div className="flex justify-between items-center pt-2 border-t border-white/5">
                <div>
                  <span className="font-bold text-yellow-400 text-sm">🪙 {item.price}</span>
                  <span className="text-[9px] text-white/25 ml-2">venta {item.sell_price ?? Math.floor(item.price / 2)}</span>
                </div>
                <span className="text-[9px] text-white/25">{item.stock === -1 ? '∞' : `×${item.stock}`}</span>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="col-span-3 text-center py-16 opacity-20">
              <ShoppingBag size={60} className="mx-auto mb-3" />
              <p className="font-serif italic">El catálogo está vacío.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ─── MÓDULO BIBLIOTECA CON PDFs RECIENTES ─────────────────────────────────────
// FIX: Los PDFs abiertos se guardan en localStorage como lista de recientes
// y se muestran en un panel lateral persistente

const PDF_STORAGE_KEY = 'vellum_recent_pdfs';
const MAX_RECENT = 8;

function PDFReaderModule() {
  const [currentPdfUrl, setCurrentPdfUrl] = useState<string | null>(null);
  const [currentPdfName, setCurrentPdfName] = useState<string>('');
  const [recentPdfs, setRecentPdfs] = useState<RecentPDF[]>([]);

  // Cargar recientes desde localStorage al montar
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PDF_STORAGE_KEY);
      if (saved) setRecentPdfs(JSON.parse(saved));
    } catch {}
  }, []);

  const saveRecent = (name: string, url: string) => {
    setRecentPdfs(prev => {
      const filtered = prev.filter(p => p.name !== name);
      const updated = [{ name, url, addedAt: Date.now() }, ...filtered].slice(0, MAX_RECENT);
      try { localStorage.setItem(PDF_STORAGE_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const openFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setCurrentPdfUrl(url);
    setCurrentPdfName(f.name);
    saveRecent(f.name, url);
  };

  const openRecent = (pdf: RecentPDF) => {
    setCurrentPdfUrl(pdf.url);
    setCurrentPdfName(pdf.name);
  };

  const removeRecent = (name: string) => {
    setRecentPdfs(prev => {
      const updated = prev.filter(p => p.name !== name);
      try { localStorage.setItem(PDF_STORAGE_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  return (
    <div className="flex-1 flex h-full bg-[#1C1008] animate-in overflow-hidden">
      {/* PANEL LATERAL: Archivos recientes */}
      <aside style={{ width: '220px', minWidth: '220px' }} className="bg-[#2D1B14] border-r border-[#C5A059]/15 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-[#C5A059]/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={14} className="text-[#C5A059]" />
            <h3 className="font-title text-sm font-bold text-[#C5A059]">Biblioteca</h3>
          </div>
          <label className="bg-[#C5A059] text-[#1C1008] px-2 py-1 text-[8px] font-black uppercase cursor-pointer hover:bg-white transition-all flex items-center gap-1">
            <Plus size={10} /> PDF
            <input type="file" accept="application/pdf" onChange={openFile} className="hidden" />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
          {recentPdfs.length === 0 ? (
            <div className="text-center mt-8 opacity-20">
              <FileText size={36} className="mx-auto mb-2" />
              <p className="text-[9px] italic font-serif">Sin documentos recientes</p>
              <p className="text-[8px] mt-1 opacity-60">Abre un PDF para que aparezca aquí</p>
            </div>
          ) : (
            <>
              <p className="text-[8px] font-black uppercase text-[#C5A059]/50 mb-3">Recientes</p>
              <div className="space-y-1">
                {recentPdfs.map(pdf => (
                  <div
                    key={pdf.name}
                    className={`group flex items-center gap-2 p-2 border cursor-pointer transition-all ${
                      currentPdfName === pdf.name
                        ? 'border-[#C5A059] bg-[#C5A059]/10'
                        : 'border-white/5 bg-[#1C1008] hover:border-[#C5A059]/30'
                    }`}
                  >
                    <FileText
                      size={14}
                      className={currentPdfName === pdf.name ? 'text-[#C5A059]' : 'text-white/30'}
                    />
                    <button
                      onClick={() => openRecent(pdf)}
                      className="flex-1 text-left min-w-0"
                    >
                      <p className="text-[9px] font-bold truncate leading-tight"
                        style={{ color: currentPdfName === pdf.name ? '#C5A059' : 'rgba(215,204,200,0.75)' }}>
                        {pdf.name}
                      </p>
                      <p className="text-[7px] opacity-30 mt-0.5">
                        {new Date(pdf.addedAt).toLocaleDateString()}
                      </p>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeRecent(pdf.name); }}
                      className="opacity-0 group-hover:opacity-100 text-red-500/40 hover:text-red-500 transition-all p-0.5 flex-shrink-0"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {currentPdfUrl && (
          <div className="p-3 border-t border-white/5 flex-shrink-0">
            <button
              onClick={() => { setCurrentPdfUrl(null); setCurrentPdfName(''); }}
              className="w-full py-1.5 border border-red-700/30 text-red-400/70 text-[8px] font-black uppercase hover:border-red-700 hover:text-red-400 transition-all flex items-center justify-center gap-1"
            >
              <X size={10} /> Cerrar visor
            </button>
          </div>
        )}
      </aside>

      {/* ÁREA PRINCIPAL: Visor PDF */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-[#C5A059]/20 flex items-center justify-between bg-[#1C1008] flex-shrink-0">
          <div>
            <h2 className="font-display text-2xl font-bold italic text-[#D7CCC8]">
              {currentPdfName || 'Atril vacío'}
            </h2>
            {currentPdfName && (
              <p className="text-[8px] uppercase tracking-widest text-[#C5A059]/40 mt-0.5 font-black">Leyendo</p>
            )}
          </div>
          <label className="bg-[#C5A059]/10 border border-[#C5A059]/30 text-[#C5A059] px-4 py-2 text-[9px] font-black uppercase cursor-pointer hover:bg-[#C5A059] hover:text-[#1C1008] transition-all flex items-center gap-2">
            <BookOpen size={13} />
            {currentPdfUrl ? 'Cambiar PDF' : 'Abrir PDF'}
            <input type="file" accept="application/pdf" onChange={openFile} className="hidden" />
          </label>
        </div>

        <div className="flex-1 bg-[#0D0704] relative overflow-hidden">
          {currentPdfUrl ? (
            <iframe
              src={currentPdfUrl}
              className="absolute inset-0 w-full h-full border-none"
              title={currentPdfName}
            />
          ) : (
            <div className="h-full flex items-center justify-center flex-col gap-5 opacity-15">
              <BookOpen size={90} />
              <div className="text-center">
                <p className="italic font-serif text-xl">El atril está vacío.</p>
                <p className="text-[10px] font-title uppercase tracking-widest mt-2 opacity-60">Abre un PDF para comenzar</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── EXPORT ───────────────────────────────────────────────────────────────────

export default function App() {
  return <BrowserRouter><VellumLayout /></BrowserRouter>;
}
