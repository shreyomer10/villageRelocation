"""
Schema descriptions for the two agents.

SCHEMA_TERSE  — field names + types only. Embedded in the Reasoner prompt.
SCHEMA_VERBOSE — same fields plus 1-2 lines of usage notes per collection.
                 Embedded in the Query-Builder prompt.

Notation:
    field:type
    list_field[]:type
    nested[].subfield:type   (array of subdocuments)

Collections in scope:
    villages, testing (families), plots, house
The `chat_sessions` collection is internal to the chat-history endpoints and
MUST NOT appear in either description — the agents are not allowed to query it.
"""

ALLOWED_COLLECTIONS = {"villages", "testing", "plots", "house"}


SCHEMA_TERSE = """\
COLLECTIONS:

villages
  villageId:str  name:str  district:str  janpad:str  tehsil:str
  gramPanchayat:str  siteOfRelocation:str
  fd:str  sd:str  range:str  circle:str  beat:str
  lat:float  long:float
  currentStage:str  currentSubStage:str  completed_substages[]:str
  emp[]:str  photos[]:str  delete:bool

testing  (this collection holds FAMILIES)
  familyId:str  mukhiyaName:str  villageId:str  plotId:str
  relocationOption:str  mukhiyaAge:str  mukhiyaGender:str  mukhiyaHealth:str
  lat:float  long:float
  currentStage:str  stagesCompleted[]:str
  members[].name:str  members[].age:int  members[].gender:str

plots
  plotId:str  name:str  typeId:str  villageId:str
  latitude:float  longitude:float
  currentStage:str  stagesCompleted[]:str  deleted:bool

house
  plotId:str  villageId:str  familyId:str  mukhiyaName:str  typeId:str
  numberOfHome:int  latitude:float  longitude:float  deleted:bool
  homeDetails[].homeId:str  homeDetails[].currentStage:str
  homeDetails[].stagesCompleted[]:str  homeDetails[].familyId:str
  homeDetails[].mukhiyaName:str
"""


SCHEMA_VERBOSE = """\
COLLECTIONS (read-only access).

villages
  Master record for each forest village being relocated.
  Soft-delete flag: `delete` (bool). Active records have delete:false.
  - villageId:str   stable string id (e.g. "VILL_42")
  - name:str  district:str  janpad:str  tehsil:str  gramPanchayat:str
  - siteOfRelocation:str  fd:str  sd:str  range:str  circle:str  beat:str
  - lat:float  long:float
  - currentStage:str       current high-level relocation stage name
  - currentSubStage:str    sub-stage within currentStage
  - completed_substages[]:str
  - emp[]:str              employee ids assigned to the village
  - photos[]:str  delete:bool

testing
  *** This is the FAMILIES collection (legacy name "testing"). ***
  No soft-delete field — every doc is treated as live.
  - familyId:str  mukhiyaName:str  villageId:str  plotId:str  (FK to plots)
  - relocationOption:str   typically "Option_1" or "Option_2"; may be missing
  - currentStage:str       per-family relocation process stage
  - stagesCompleted[]:str
  - mukhiyaAge:str  mukhiyaGender:str  mukhiyaHealth:str
  - lat:float  long:float
  - members[]:subdoc        family members
      .name:str  .age:int  .gender:str  .healthIssues:str  .photo:str
  Typical filters: {"villageId": "VILL_X"} to scope to one village.
  Group keys: $relocationOption, $currentStage, $villageId.

plots
  Construction plots allocated to relocated families.
  Soft-delete flag: `deleted` (bool, note spelling).
  - plotId:str  name:str  typeId:str  villageId:str
  - latitude:float  longitude:float
  - currentStage:str       construction stage of the plot itself
  - stagesCompleted[]:str
  - deleted:bool
  Typical filters: {"deleted": false}, scope with "villageId".

house
  Houses built on plots. Each doc represents the house-build at one plot
  and contains one entry in homeDetails[] per home unit on that plot.
  Soft-delete flag: `deleted` (bool).
  - plotId:str   (FK to plots)
  - villageId:str  familyId:str  mukhiyaName:str  typeId:str
  - numberOfHome:int   count of home units in this doc
  - latitude:float  longitude:float  deleted:bool
  - homeDetails[]:subdoc    one per individual home unit
      .homeId:str  .currentStage:str  .stagesCompleted[]:str
      .familyId:str  .mukhiyaName:str
  For per-home stage analytics use `$unwind: "$homeDetails"`, then
  group on `$homeDetails.currentStage`.

Notes for query construction
  * `_id` in mongo is an ObjectId; prefer the string ids (`villageId`,
    `familyId`, `plotId`, `homeDetails.homeId`) for filters.
  * String comparison is case-sensitive — do not lower-case fields unless
    the user explicitly asked for case-insensitive matching.
  * For counts prefer `aggregate` with `$count` or `$group + $sum:1`
    over loading documents.
  * To scope a query to one village, every collection here has `villageId`.
"""
