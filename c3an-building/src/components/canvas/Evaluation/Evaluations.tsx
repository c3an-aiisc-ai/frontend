import React, { Children } from "react";
import  Sidebar from "../panels/Sidebar";
import  AgentBlock  from "../AgentBlock";
import ToolNode from "../ToolNode"
import HandleDot from "../HandleDot";
import UploadNode from "../UploadNode";
import NodePanel from "..panels/NodePanel";
import background from "..ui/background";




type Props = {
  title : string;
  subTitle : string;
  children : React.ReactNode;
}

const EvalsDashboard = React.FC = () => {
  return (

    <div style={{ display: "flex", height: "100vh" }}>
      <Sidebar />
      <NodePanel />
      <background />
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <AgentBlock />
        {/* Waiting for Input&Output Streams to be created*/}
        <handleIO />
        <UploadNode />
        <HandleDot />
        <ToolNode />
      </div>
    </div>
  )
};