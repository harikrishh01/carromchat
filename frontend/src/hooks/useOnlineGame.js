import { useEffect, useRef, useCallback } from "react";
import { useGameStore } from "../store/gameStore.js";
import { connectSocket } from "../network/socket.js";
import { GAME_STATUS } from "../constants/gameConstants.js";
import { useSoundManager } from "./useSoundManager.js";
import { onlineAnimator } from "../services/onlineAnimator.js";

export function useOnlineGame(callbacks = {}) {
  const sound = useSoundManager();
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;
  const lastShotRef = useRef(null);

  useEffect(() => {
    const socket = connectSocket();
    socket.off("room_created").on("room_created", ({ roomCode, playerNum, state }) => {
      const s = useGameStore.getState(); s.setRoomCode(roomCode); s.setMyPlayerNum(playerNum); s.applyResult(state);
      useGameStore.setState({ status: GAME_STATUS.WAITING }); cbRef.current.onRoomCreated?.({ roomCode, playerNum });
      // Persist so page refresh can auto-rejoin
      sessionStorage.setItem('carrom_room', JSON.stringify({ roomCode, playerNum }));
    });
    socket.off("room_joined").on("room_joined", ({ roomCode, playerNum, state }) => {
      const s = useGameStore.getState(); s.setRoomCode(roomCode); s.setMyPlayerNum(playerNum); s.applyResult(state);
      cbRef.current.onRoomJoined?.({ roomCode, playerNum });
      sessionStorage.setItem('carrom_room', JSON.stringify({ roomCode, playerNum }));
    });
    socket.off("game_start").on("game_start", ({ state }) => {
      useGameStore.getState().applyResult(state);
      useGameStore.setState({ status: GAME_STATUS.PLAYING, isSimulating: false });
      cbRef.current.onGameStart?.({});
    });
    socket.off("shot_result").on("shot_result", ({ state: serverState, shotParams, foul }) => {
      const params = shotParams ?? lastShotRef.current;
      lastShotRef.current = null;
      onlineAnimator.handleServerResult(params, serverState, foul, soundRef.current, () => {
        cbRef.current.onShotResult?.({ foul });
      });
    });
    socket.off("game_over").on("game_over", ({ winner, scores }) => {
      if (!useGameStore.getState().isSimulating) useGameStore.setState({ winner, scores, status: GAME_STATUS.FINISHED });
      sessionStorage.removeItem('carrom_room');
      cbRef.current.onGameOver?.({ winner, scores });
    });
    socket.off("turn_timeout").on("turn_timeout", ({ state }) => { useGameStore.getState().applyResult(state); });
    socket.off("player_disconnected").on("player_disconnected", ({ playerNum, message }) => {
      useGameStore.setState({ isSimulating: false }); cbRef.current.onDisconnect?.({ playerNum, message });
    });
    socket.off("player_reconnected").on("player_reconnected", ({ message }) => { cbRef.current.onReconnect?.({ message }); });
    socket.off("connection_lost").on("connection_lost", ({ message }) => {
      const { myPlayerNum } = useGameStore.getState();
      if (myPlayerNum) useGameStore.setState({ winner: myPlayerNum, status: GAME_STATUS.FINISHED, isSimulating: false });
      sessionStorage.removeItem('carrom_room');
      cbRef.current.onConnectionLost?.({ message });
    });
    socket.off("rejoin_ack").on("rejoin_ack", ({ state, playerNum }) => {
      useGameStore.getState().applyResult(state);
      useGameStore.setState({ status: GAME_STATUS.PLAYING, isSimulating: false });
      const store = useGameStore.getState();
      const pNum = playerNum ?? store.myPlayerNum;
      if (!store.myPlayerNum) useGameStore.setState({ myPlayerNum: pNum });
      if (pNum && store.roomCode) sessionStorage.setItem('carrom_room', JSON.stringify({ roomCode: store.roomCode, playerNum: pNum }));
      cbRef.current.onReconnect?.({ message: "Reconnected. Game resumed." });
    });
    socket.off("error").on("error", ({ message }) => { useGameStore.setState({ isSimulating: false }); cbRef.current.onError?.({ message }); });
    socket.off("invalid_shot").on("invalid_shot", () => { useGameStore.setState({ isSimulating: false }); onlineAnimator.destroy(); onlineAnimator.init(); });
    socket.off("connect").on("connect", () => {
      // Try Zustand first, then sessionStorage (survives page refresh)
      let { roomCode, myPlayerNum } = useGameStore.getState();
      if (!roomCode || !myPlayerNum) {
        try {
          const saved = JSON.parse(sessionStorage.getItem('carrom_room') || 'null');
          if (saved?.roomCode && saved?.playerNum) {
            roomCode = saved.roomCode;
            myPlayerNum = saved.playerNum;
            useGameStore.setState({ roomCode, myPlayerNum: saved.playerNum });
          }
        } catch (_) {}
      }
      if (roomCode && myPlayerNum) socket.emit("rejoin_room", { roomCode, playerNum: myPlayerNum });
    });
    return () => { ["room_created","room_joined","game_start","shot_result","game_over","turn_timeout","player_disconnected","player_reconnected","connection_lost","rejoin_ack","error","invalid_shot","connect"].forEach(e => socket.off(e)); };
  }, []);

  const createRoom = useCallback((playerName) => { connectSocket().emit("create_room", { playerName }); }, []);
  const joinRoom = useCallback((roomCode, playerName) => { connectSocket().emit("join_room", { roomCode: roomCode.toUpperCase(), playerName }); }, []);
  const leaveRoom = useCallback(() => {
    const { roomCode } = useGameStore.getState();
    if (roomCode) {
      connectSocket().emit("leave_room", { roomCode });
      // Keep sessionStorage so they can rejoin via code
    }
  }, []);
  const shoot = useCallback((angle, power, strikerX) => {
    const { roomCode, myPlayerNum, turn, status, isSimulating } = useGameStore.getState();
    if (status !== GAME_STATUS.PLAYING || myPlayerNum !== turn || isSimulating) return;
    lastShotRef.current = { angle, power, strikerX };
    useGameStore.setState({ isSimulating: true });
    soundRef.current.playShoot();
    onlineAnimator.startLocal({ angle, power, strikerX }, soundRef.current);
    connectSocket().emit("shoot", { angle, power, strikerX, roomCode });
  }, []);
  const requestRematch = useCallback(() => { connectSocket().emit("request_rematch", { roomCode: useGameStore.getState().roomCode }); }, []);
  return { createRoom, joinRoom, leaveRoom, shoot, requestRematch };
}