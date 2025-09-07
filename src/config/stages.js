// src/config/stageDefs.js

export const stageDefs = [
  {
    stage_id: 1,
    name: "Gram Sabha Consent",
    subStages: [
      { id: 1, name: "Option 1 & 2 Survey" },
      { id: 2, name: "Land Identified" },
      { id: 3, name: "Gram Sabha Consent – Source" },
      { id: 4, name: "Gram Sabha Consent – Destination" },
    ],
  },
  {
    stage_id: 2,
    name: "Diversion of Land",
    subStages: [
      { id: 1, name: "DGPS Survey" },
      { id: 2, name: "Registration" },
      { id: 3, name: "First Stage Clearance" },
      { id: 4, name: "Second Stage Clearance" },
    ],
  },
  {
    stage_id: 3,
    name: "Budget & Eligibility",
    subStages: [
      { id: 1, name: "Budget Proposal sent" },
      { id: 2, name: "Budget Received from CAMPA" },
      { id: 3, name: "Budget Transferred to Collector" },
      { id: 4, name: "Eligibility Determination Committee Constituted" },
      { id: 5, name: "Cut off Date Declared" },
      { id: 6, name: "Final list of eligible beneficiaries" },
      { id: 7, name: "Village Relocation & Development Plan" },
    ],
  },
  {
    stage_id: 4,
    name: "Option 1 Execution",
    subStages: [
      { id: 1, name: "Joint Accounts created" },
      { id: 2, name: "Amount transferred to joint accounts" },
      { id: 3, name: "House built" },
    ],
  },
  {
    stage_id: 5,
    name: "Option 2 Execution",
    subStages: [
      { id: 1, name: "Village Relocation & Development Committee Constituted" },
      { id: 2, name: "Joint accounts created" },
      { id: 3, name: "Amount transferred to joint accounts" },
      { id: 4, name: "Amount transferred to PD a/c of DD" },
      { id: 5, name: "Houses built" },
      { id: 6, name: "Community Development as per plan" },
    ],
  },
  {
    stage_id: 6,
    name: "Relocation Complete",
    subStages: [
      { id: 1, name: "MoU signed with eligible beneficiaries" },
      { id: 2, name: "Entire Option 1 amount transferred to beneficiary" },
      { id: 3, name: "Entire houses built under Option 1 & 2" },
      { id: 4, name: "Village vacated and shifted" },
      { id: 5, name: "Razing of remains in villages" },
    ],
  },
];
