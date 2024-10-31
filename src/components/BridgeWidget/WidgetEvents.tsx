"use client";
import type { Route } from "@lifi/sdk";
import type {
  RouteExecutionUpdate,
  RouteHighValueLossUpdate,
} from "@lifi/widget";
import { WidgetEvent, useWidgetEvents } from "@lifi/widget";
import { BrowserProvider, ethers } from "ethers";
import { useEffect } from "react";
import { BuyPostage } from "../contractFunctions";
import { useGlobal } from "@/context/Global";
import {
  useWeb3ModalAccount,
  useWeb3ModalProvider,
} from "@web3modal/ethers/react";

export const WidgetEvents = () => {
  const widgetEvents = useWidgetEvents();
  const { address } = useWeb3ModalAccount();
  const { walletProvider } = useWeb3ModalProvider();
  const { calculateData } = useGlobal();
  useEffect(() => {
    const onRouteExecutionStarted = (route: Route) => {};
    const onRouteExecutionUpdated = (update: RouteExecutionUpdate) => {};
    const onRouteExecutionCompleted = (route: Route) => {
      BuyPostage(
        walletProvider as ethers.Eip1193Provider,
        address as string,
        calculateData
      );
    };
    const onRouteExecutionFailed = (update: RouteExecutionUpdate) => {};
    const onRouteHighValueLoss = (update: RouteHighValueLossUpdate) => {};
    widgetEvents.on(WidgetEvent.RouteExecutionStarted, onRouteExecutionStarted);
    widgetEvents.on(WidgetEvent.RouteExecutionUpdated, onRouteExecutionUpdated);
    widgetEvents.on(
      WidgetEvent.RouteExecutionCompleted,
      onRouteExecutionCompleted
    );
    widgetEvents.on(WidgetEvent.RouteHighValueLoss, onRouteHighValueLoss);
    widgetEvents.on(WidgetEvent.RouteExecutionFailed, onRouteExecutionFailed);
    return () => widgetEvents.all.clear();
  }, [widgetEvents]);

  return null;
};
