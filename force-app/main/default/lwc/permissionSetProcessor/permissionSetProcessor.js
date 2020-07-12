import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getPermissionSetOptions from '@salesforce/apex/PermissionSetProcessor.getPermissionSetOptions';
import getPermisssionMap from '@salesforce/apex/PermissionSetProcessor.getPermisssionMap';
import dmlPermissions from '@salesforce/apex/PermissionSetProcessor.dmlPermissions';

const OBJECT_PERMISSIONS = 'OBJECT_PERMISSIONS';
const FIELD_PERMISSIONS = 'FIELD_PERMISSIONS';

const DML_TYPE_INSERT = 'INSERT';
const DML_TYPE_UPDATE = 'UPDATE';

const PERMISSION_TYPES = [
    { label: 'Field Level Permissions', value: FIELD_PERMISSIONS },
    { label: 'Object Level Permissions', value: OBJECT_PERMISSIONS }
];

const FIELD_PERMISSION_OBJECT = 'FieldPermissions';
const FIELD_PERMISSION_KEY_FIELD = 'Field';
const FIELD_PERMISSION_FIELDS = ['Field', 'PermissionsRead', 'PermissionsEdit'];
const FIELD_PERMISSION_FIELDS_HEADER = [
    { name: 'Field', placeHolder: 'Start Typing to search by Field Name', isKeyField: true, size: 'slds-col slds-size_8-of-12 header-cell-border-padding' },
    { name: 'Read', isKeyField: false, size: 'slds-col slds-size_2-of-12 header-cell-border-padding' },
    { name: 'Edit', isKeyField: false, size: 'slds-col slds-size_2-of-12 header-cell-border-padding' }
];

const OBJECT_PERMISSION_OBJECT = 'ObjectPermissions';
const OBJECT_PERMISSION_KEY_FIELD = 'SobjectType';
const OBJECT_PERMISSION_FIELDS = ['SobjectType', 'PermissionsCreate', 'PermissionsRead', 'PermissionsEdit', 'PermissionsDelete', 'PermissionsViewAllRecords', 'PermissionsModifyAllRecords'];
const OBJECT_PERMISSION_FIELDS_HEADER = [
    { name: 'SobjectType', placeHolder: 'Start Typing to search by SobjectType Name', isKeyField: true, size: 'slds-col slds-size_6-of-12 header-cell-border-padding' },
    { name: 'Create', isKeyField: false, size: 'slds-col slds-size_1-of-12 header-cell-border-padding' },
    { name: 'Read', isKeyField: false, size: 'slds-col slds-size_1-of-12 header-cell-border-padding' },
    { name: 'Edit', isKeyField: false, size: 'slds-col slds-size_1-of-12 header-cell-border-padding' },
    { name: 'Delete', isKeyField: false, size: 'slds-col slds-size_1-of-12 header-cell-border-padding' },
    { name: 'ViewAll', isKeyField: false, size: 'slds-col slds-size_1-of-12 header-cell-border-padding' },
    { name: 'ModifyAll', isKeyField: false, size: 'slds-col slds-size_1-of-12 header-cell-border-padding' }
];

const LEFT = 'Left';
const KEEP_DIFF = 'Keep Diff';
const RIGHT = 'Right';

const ACTION_OPTIONS = [
    { label: LEFT, value: LEFT, iconName: 'utility:back', disabled: true, checked: false },
    { label: KEEP_DIFF, value: KEEP_DIFF, iconName: 'utility:recurring_exception', disabled: false, checked: true },
    { label: RIGHT, value: RIGHT, iconName: 'utility:forward', disabled: true, checked: false }
];

const TIMER_DELAY = 300; //200 ms wait

export default class PermissionSetProcessor extends LightningElement {

    @track error;
    @track selectedPermissionSet1;
    @track selectedPermissionSet2;
    @track permissionSetList;
    @track permissionTypeList = PERMISSION_TYPES;

    @track selectedPermissionType1;
    @track selectedPermissionType2;

    @track permissionHeader = [];

    @track rawPermissionSet1JSON = [];
    @track rawPermissionSet2JSON = [];

    @track permissionSet1JSON = [];
    @track permissionSet2JSON = [];
    @track permissionSetActionJSON = [];

    @track sortedPermissionSet1JSONMap = new Map();
    @track sortedPermissionSet2JSONMap = new Map();
    @track sortedPermissionSetActionJSONMap = new Map();

    @track permissionInsertMap = new Map();
    @track permissionUpdateMap = new Map();
    @track permissionDeleteMap = new Map();

    @track hasAddedDynamicCSS = false;
    @track hasInitiatedDiffBothMatch = false;

    @track progressPercentage = -1;
    @track whatsInProgress = 'calculating';
    @track showPageBackDrop = false;

    //menu button toggle text
    @track toggleShowSelectedBtnText = 'Show Only Selected';
    @track toggleAllLeftSyncBtnText = 'Select Applicable to Left'
    @track toggleAllRightSyncBtnText = 'Select Applicable to Right'

    @track diffBothMatchOptions = [
        { label: "Diff", value: 'Diff', disabled: false, checked: false, groupName: 'diffBothMatch' },
        { label: 'Both', value: 'Both', disabled: false, checked: true, groupName: 'diffBothMatch' },
        { label: 'Match', value: 'Match', disabled: true, checked: false, groupName: 'diffBothMatch' }
    ];

    @track resultArray = [];
    @track showResultModal = false;

    searchTimer;
    searchedText = '';
    oldSearchText = '';

    @track actionOptions = [
        { label: LEFT, value: LEFT, iconName: 'utility:back', disabled: true, checked: false },
        { label: KEEP_DIFF, value: KEEP_DIFF, iconName: 'utility:recurring_exception', disabled: false, checked: true },
        { label: RIGHT, value: RIGHT, iconName: 'utility:forward', disabled: true, checked: false }
    ];

    connectedCallback() {
        this.loadPermissionSetOptions();
    }

    renderedCallback() {
        //dynamic css
        if(this.hasAddedDynamicCSS === false){
            let scrollingGrid = this.template.querySelector('.scrolling-grid');
            if (scrollingGrid !== undefined) {            
                const style = document.createElement('style');
                style.innerText = `
                    c-permission-set-processor .slds-radio_button [type=radio]:checked+.slds-radio_button__label .slds-icon {
                        fill: white;
                    }
                `;                
                this.template.querySelector('.scrolling-grid').appendChild(style);
                this.hasAddedDynamicCSS = true;
            }
        }
        //diffBothMatch initially set to Both
        if(this.hasInitiatedDiffBothMatch === false && this.permissionSet1JSON.length>0 && this.permissionSet2JSON.length>0){
            let diffBothMatchs = this.template.querySelectorAll('.radio-diff-both-match');
            if(diffBothMatchs !== undefined && diffBothMatchs !== null && diffBothMatchs.length>0){
                diffBothMatchs[1].checked = true;
                this.hasInitiatedDiffBothMatch = true;
            }            
        }       
    }

    loadPermissionSetOptions() {
        getPermissionSetOptions()
            .then(result => {
                this.permissionSetList = result;
            })
            .catch(error => {
                this.error = error;
            });
    }

    handlePermissionSetChange(event) {
        if (event.target.name === 'permissionSet1') {
            this.selectedPermissionSet1 = event.detail.value;
        }
        if (event.target.name === 'permissionSet2') {
            this.selectedPermissionSet2 = event.detail.value;
        }
        this.reloadScrollingGrid();
    }

    handlePermissionTypeChange(event) {
        if (event.target.name === 'permissionType1') {
            this.selectedPermissionType1 = event.detail.value;
        }
        if (event.target.name === 'permissionType2') {
            this.selectedPermissionType2 = event.detail.value;
        }
        this.reloadScrollingGrid();
    }

    get comparisonExist() {
        if (this.permissionHeader.length > 0) {
            return true;
        }
        return false;
    }

    get isFieldPermission() {
        if (this.selectedPermissionType1 === FIELD_PERMISSIONS) {
            return true;
        }
        return false;
    }

    get isObjectPermission() {
        if (this.selectedPermissionType1 === OBJECT_PERMISSIONS) {
            return true;
        }
        return false;
    }

    get showProgessCounter() {
        if (this.progressPercentage >= 0 && this.progressPercentage < 100) {
            return true;
        }
        return false;
    }

    setProgressPercentage(percentComplete) {
        this.progressPercentage = percentComplete;
    }

    initializeDataObjects() {
        this.permissionSet1JSON = [];
        this.permissionSet2JSON = [];
        this.permissionSetActionJSON = [];

        this.sortedPermissionSet1JSONMap = new Map();
        this.sortedPermissionSet2JSONMap = new Map();
        this.sortedPermissionSetActionJSONMap = new Map();

        this.permissionInsertMap = new Map();
        this.permissionUpdateMap = new Map();
        this.permissionDeleteMap = new Map();
    }

    loadAllPermissions() {
        if (this.getStringDefault(this.selectedPermissionSet1) !== '' && this.getStringDefault(this.selectedPermissionType1) !== '' && this.getStringDefault(this.selectedPermissionSet2) !== '' && this.getStringDefault(this.selectedPermissionType2) !== '') {

            if (this.selectedPermissionType1 === this.selectedPermissionType2) {

                //progress - initialized permisions load
                this.setProgressPercentage(0);
                this.whatsInProgress = 'Loading first permission set';

                getPermisssionMap({ permissionSetId: this.selectedPermissionSet1, permissionType: this.selectedPermissionType1 })
                    .then(result => {

                        this.rawPermissionSet1JSON = result;

                        //progress - left permissionset fetch complete 
                        this.setProgressPercentage(25);
                        this.whatsInProgress = 'Loading second permission set';

                        getPermisssionMap({ permissionSetId: this.selectedPermissionSet2, permissionType: this.selectedPermissionType2 })
                            .then(result => {

                                this.rawPermissionSet2JSON = result;

                                //progress - right permissionset fetch complete 
                                this.setProgressPercentage(50);
                                this.whatsInProgress = 'Comparing permission sets';

                                if (this.rawPermissionSet1JSON.length > 0 || this.rawPermissionSet2JSON.length > 0) {
                                    this.hasInitiatedDiffBothMatch = false;
                                    this.compareJSONArray(this.rawPermissionSet1JSON, this.rawPermissionSet2JSON);
                                    //progress - comparision complete 
                                    this.setProgressPercentage(100);
                                    this.whatsInProgress = 'Rendering';
                                    this.showPageBackDrop = false;
                                }else{
                                    let messageHeader = 'No ' + this.selectedPermissionType1 + ' exist to compare on the compared permissionsets or profiles.';
                                    let message = 'This scenario happens mostly on any new permissionsets since salesforce does not make the fieldpermissions or objectpermissions records available until one of the permssions is manually modified for the sobjecttype (fieldpermissions or objectpermissions).';
                                    this.resultArray.push({value:message, key:messageHeader});
                                    this.showResultModal = true;
                                    this.setProgressPercentage(100);
                                    this.whatsInProgress = 'Rendering Result Modal';
                                    this.showPageBackDrop = false;
                                }
                            })
                            .catch(error => {
                                this.error = error;
                            });

                    })
                    .catch(error => {
                        this.error = error;
                    });
            }
        }
    }

    reloadScrollingGrid() {
        this.initializeDataObjects();
        this.initiateSearchTextField();
        this.updateSelectionCountBadge();
        this.initiateToggles();
        this.loadAllPermissions();
    }

    dmlPermissionRecords(recordsToInsert, recordsToUpdate) {
        const dmlData = this.getDMLMap(recordsToInsert, recordsToUpdate);
        //progress - get DMLS ready
        this.setProgressPercentage(50);
        this.whatsInProgress = 'Sync - data updates in-progress';
        dmlPermissions({ data: dmlData })
            .then(result => {
                
                for(let key in result){
                    if (key.length > 0 && key.indexOf('successful') !== -1) {
                        this.resultArray.push({value:result[key], key:key});
                        this.showResultModal = true;
                        //progress - DMLs complete
                        this.setProgressPercentage(100);
                        this.whatsInProgress = 'Sync - data updates complete';
                        this.reloadScrollingGrid();
                    } else {
                        this.resultArray.push({value:result[key], key:key});
                        this.showResultModal = true;
                        //progress - DMLs complete
                        this.setProgressPercentage(100);
                        this.whatsInProgress = 'Sync - data updates complete';
                        this.reloadScrollingGrid();
                    }
                }

            })
            .catch(error => {
                this.error = error;
                this.resultArray.push({value:JSON.stringify(this.error), key:'Error'});
                this.showResultModal = true;
            });
    }

    closeResultModal(){
        this.resultArray= [];
        this.showResultModal = false;
    }

    getDMLMap(recordsToInsert, recordsToUpdate) {
        let dmlData = {};
        let insertKey;
        let updateKey;
        let objectContext;

        if (this.selectedPermissionType1 === FIELD_PERMISSIONS) {
            objectContext = FIELD_PERMISSIONS;
        }
        else if (this.selectedPermissionType1 === OBJECT_PERMISSIONS) {
            objectContext = OBJECT_PERMISSIONS
        }

        insertKey = DML_TYPE_INSERT + '|' + objectContext;
        updateKey = DML_TYPE_UPDATE + '|' + objectContext;

        if (recordsToInsert.length > 0) {
            dmlData[insertKey] = JSON.stringify(recordsToInsert);
        }
        if (recordsToUpdate.length > 0) {
            dmlData[updateKey] = JSON.stringify(recordsToUpdate);
        }

        return dmlData;
    }

    compareJSONArray(JSON1, JSON2) {

        let permissionSet1JSONMap = new Map();
        let permissionSet2JSONMap = new Map();

        let loopEnd = JSON1.length > JSON2.length ? JSON1.length : JSON2.length;

        if (loopEnd > 0) {
            this.formFieldHeaders();
        }

        let keyField;

        if (this.selectedPermissionType1 === FIELD_PERMISSIONS) {
            keyField = FIELD_PERMISSION_KEY_FIELD;
        }
        else if (this.selectedPermissionType1 === OBJECT_PERMISSIONS) {
            keyField = OBJECT_PERMISSION_KEY_FIELD;
        }

        let leftRightCommonClass = 'slds-grid slds-grid_vertical-align-center slds-grid_align-center';

        //forming left and right map for comparision
        for (let i = 0; i < loopEnd; i++) {

            if (JSON1.length > i) {
                let JSON1Target = Object.assign(JSON1[i], { class: '', rowClass: '' });

                if (permissionSet1JSONMap.get(JSON1Target[keyField]) == null) {
                    permissionSet1JSONMap = this.initializeKeyFieldAndClassAttributes(JSON1Target, keyField, permissionSet1JSONMap);
                }
                if (permissionSet2JSONMap.get(JSON1Target[keyField]) == null) {
                    permissionSet2JSONMap = this.initializeKeyFieldAndClassAttributes(JSON1Target, keyField, permissionSet2JSONMap);
                }
                permissionSet1JSONMap.set(JSON1Target[keyField], JSON1Target);
            }

            if (JSON2.length > i) {
                let JSON2Target = Object.assign(JSON2[i], { class: '', rowClass: '' });

                if (permissionSet1JSONMap.get(JSON2Target[keyField]) == null) {
                    permissionSet1JSONMap = this.initializeKeyFieldAndClassAttributes(JSON2Target, keyField, permissionSet1JSONMap);
                }
                if (permissionSet2JSONMap.get(JSON2Target[keyField]) == null) {
                    permissionSet2JSONMap = this.initializeKeyFieldAndClassAttributes(JSON2Target, keyField, permissionSet2JSONMap);
                }
                permissionSet2JSONMap.set(JSON2Target[keyField], JSON2Target);
            }
        }

        //comparison
        for (const [key, value] of permissionSet1JSONMap.entries()) {
            let permissionSet1Obj = permissionSet1JSONMap.get(key);
            let permissionSet2Obj = permissionSet2JSONMap.get(key);
            permissionSet1Obj.rowClass = leftRightCommonClass;
            permissionSet2Obj.rowClass = leftRightCommonClass;
            if (this.selectedPermissionType1 === FIELD_PERMISSIONS) {
                FIELD_PERMISSION_FIELDS.forEach(field => {
                    if (permissionSet1Obj[field] === permissionSet2Obj[field]) {
                        permissionSet1Obj.class = 'green';
                        permissionSet2Obj.class = 'green';
                    } else {
                        permissionSet1Obj.class = 'red';
                        permissionSet2Obj.class = 'red';
                    }
                });
            }
            else if (this.selectedPermissionType1 === OBJECT_PERMISSIONS) {
                OBJECT_PERMISSION_FIELDS.forEach(field => {
                    if (permissionSet1Obj[field] === permissionSet2Obj[field]) {
                        permissionSet1Obj.class = 'green';
                        permissionSet2Obj.class = 'green';
                    } else {
                        permissionSet1Obj.class = 'red';
                        permissionSet2Obj.class = 'red';
                    }
                });
            }
        };

        //sorting left and right compared map
        this.sortedPermissionSet1JSONMap = new Map([...permissionSet1JSONMap.entries()].sort());
        
        this.sortedPermissionSet2JSONMap = new Map([...permissionSet2JSONMap.entries()].sort());
        
        //Task field permissions to exclude since salesforce repeats the same permission for event object
        let excludedKeys = ['Task.Description', 'Task.What', 'Task.Who'];
        let taskCustomFieldPrefix = 'Task';
        let taskCustomFieldSuffix = '__c';
        //forming the middle action column based on the left and right   
        this.permissionSetActionJSON = [];
        for (const [key, value] of this.sortedPermissionSet1JSONMap.entries()) {
            let taskCustomKey = key.startsWith('Task') === true && key.endsWith('__c')===true ? true : false;
            if(!excludedKeys.includes(key) && !taskCustomKey) {                
                let permissionSet1Obj = this.sortedPermissionSet1JSONMap.get(key);
                let permissionSet2Obj = this.sortedPermissionSet2JSONMap.get(key);
                this.permissionSet1JSON.push(permissionSet1Obj);
                this.permissionSet2JSON.push(permissionSet2Obj);
                //forming action object for 
                //1. property allowing left/right syncing based on the data exising on either side.
                //2. have objects ready presuming left and right syncing if syncing allowed for that context
                let actionClass = 'slds-grid slds-wrap';
                let actionObj = {
                    key: key,
                    disableLeftSync: true,
                    disableRightSync: true,
                    objForSyncingToLeft: {},
                    objForSyncingToRight: {},
                    actionOptions: [],
                    class: 'hide',
                    rowClass: actionClass
                };

                actionObj.actionOptions[0] = Object.assign({}, this.actionOptions[0]);
                actionObj.actionOptions[1] = Object.assign({}, this.actionOptions[1]);
                actionObj.actionOptions[2] = Object.assign({}, this.actionOptions[2]);

                //compare left right to determine show/hide actions
                this.showHideActions(actionObj, permissionSet1Obj, permissionSet2Obj);

                //forming actionObj.objForSyncingToRight and related
                if (this.getStringDefault(permissionSet1Obj.Id) !== '') {
                    let tempObj = {};
                    //getting permission type specific object/field data synced
                    tempObj = this.syncSpecificObjectFieldData(permissionSet1Obj, tempObj);
                    tempObj.parentId = this.selectedPermissionSet2;
                    tempObj.id = permissionSet2Obj.Id;
                    actionObj.objForSyncingToRight = tempObj;
                    actionObj.disableRightSync = false;
                }

                //forming actionObj.objForSyncingToLeft and related
                if (this.getStringDefault(permissionSet2Obj.Id) !== '') {
                    let tempObj = {};
                    //getting permission type specific object/field data synced
                    tempObj = this.syncSpecificObjectFieldData(permissionSet2Obj, tempObj);
                    tempObj.parentId = this.selectedPermissionSet1;
                    tempObj.id = permissionSet1Obj.Id;
                    actionObj.objForSyncingToLeft = tempObj;
                    actionObj.disableLeftSync = false;
                }

                actionObj.actionOptions[0].disabled = actionObj.disableLeftSync;
                actionObj.actionOptions[2].disabled = actionObj.disableRightSync;

                this.permissionSetActionJSON.push(actionObj);
                this.sortedPermissionSetActionJSONMap.set(key, actionObj);
            }
        }        
    }

    initializeKeyFieldAndClassAttributes(sourceJSONSource, keyField, targetMap) {
        if (this.selectedPermissionType1 === FIELD_PERMISSIONS) {
            targetMap.set(sourceJSONSource[keyField], { Field: sourceJSONSource[keyField], class: '' });
        }
        else if (this.selectedPermissionType1 === OBJECT_PERMISSIONS) {
            targetMap.set(sourceJSONSource[keyField], { SobjectType: sourceJSONSource[keyField], class: '' });
        }
        return targetMap;
    }

    showHideActions(actionObj, permissionSet1Obj, permissionSet2Obj) {
        if (this.selectedPermissionType1 === FIELD_PERMISSIONS) {
            FIELD_PERMISSION_FIELDS.forEach(field => {
                if (permissionSet1Obj[field] !== permissionSet2Obj[field]) {
                    actionObj.class = 'show';
                }
            });
        }
        else if (this.selectedPermissionType1 === OBJECT_PERMISSIONS) {
            OBJECT_PERMISSION_FIELDS.forEach(field => {
                if (permissionSet1Obj[field] !== permissionSet2Obj[field]) {
                    actionObj.class = 'show';
                }
            });
        }
    }

    syncSpecificObjectFieldData(source, target) {
        if (this.selectedPermissionType1 === FIELD_PERMISSIONS) {
            target.SobjectType = source.SobjectType;
            FIELD_PERMISSION_FIELDS.forEach(field => {
                target[field] = source[field];
            });
        }
        else if (this.selectedPermissionType1 === OBJECT_PERMISSIONS) {
            OBJECT_PERMISSION_FIELDS.forEach(field => {
                target[field] = source[field];
            });
        }
        return target;
    }

    formFieldHeaders() {
        if (this.selectedPermissionType1 === FIELD_PERMISSIONS) {
            this.permissionHeader = [...FIELD_PERMISSION_FIELDS_HEADER];
        }
        else if (this.selectedPermissionType1 === OBJECT_PERMISSIONS) {
            this.permissionHeader = [...OBJECT_PERMISSION_FIELDS_HEADER];
        }
    }

    handleRadioFocus(event) {
        let currentTarget = event.currentTarget;
        currentTarget.previousSibling.checked = true;
        this.formPermissionRecords(currentTarget.previousSibling.value, currentTarget.previousSibling.name);
    }

    handleActionRadioGroupChange(event) {
        event.preventDefault();
        const selectedOption = event.currentTarget.value;
        const selectedKey = event.currentTarget.name;
        this.formPermissionRecords(selectedOption, selectedKey);
    }

    formPermissionRecords(selectedOption, selectedKey) {
        let selectedActionJSON = this.sortedPermissionSetActionJSONMap.get(selectedKey);
        if (selectedOption === LEFT) {
            //loading insert or update record on to the map
            this.loadInsertOrUpdateRecord(selectedKey, selectedActionJSON.objForSyncingToLeft);
        } else if (selectedOption === RIGHT) {
            //loading insert or update record on to the map
            this.loadInsertOrUpdateRecord(selectedKey, selectedActionJSON.objForSyncingToRight);
        } else if (selectedOption === KEEP_DIFF) {
            //removing insert or update record on to the map
            this.deleteInsertAndUpdateRecord(selectedKey);
        }
        this.updateSelectionCountBadge();
    }

    loadInsertOrUpdateRecord(key, permissionRecord) {
        if (this.getStringDefault(permissionRecord.id) !== '') {
            this.permissionUpdateMap.set(key, permissionRecord);
        } else {
            this.permissionInsertMap.set(key, permissionRecord);
        }
    }

    deleteInsertAndUpdateRecord(key){
        if (this.permissionInsertMap.get(key) != null) {
            this.permissionInsertMap.delete(key);
        }
        if (this.permissionUpdateMap.get(key) != null) {
            this.permissionUpdateMap.delete(key);
        }
    }

    updateSelectionCountBadge(){
        let selectionCountBadge = this.template.querySelector('.selection-count-badge');
        if(selectionCountBadge!==undefined && selectionCountBadge!==null){
            selectionCountBadge.innerHTML = this.permissionInsertMap.size + this.permissionUpdateMap.size;
        }        
    }

    handleSyncSelected(event) {
        event.preventDefault();
        if (this.permissionInsertMap.size === 0 && this.permissionUpdateMap.size === 0) {
            const evt = new ShowToastEvent({
                title: 'Warning: ',
                message: 'No items selected for sync!',
                variant: 'warning',
            });
            this.dispatchEvent(evt);
        } else {
            this.showPageBackDrop = true;
            //progress - initialized permisions objects for dml
            this.setProgressPercentage(0);
            this.whatsInProgress = 'Staring sync';
            let permissionInsertArray = [...this.permissionInsertMap.values()];
            let permissionUpdateArray = [...this.permissionUpdateMap.values()];
            this.dmlPermissionRecords(permissionInsertArray, permissionUpdateArray);
        }
    }
    
    initiateSearchTextField(){
        this.searchedText = '';
        let searchedTextInput = this.template.querySelector('[data-id="left-search-input"]');
        if(searchedTextInput!==undefined && searchedTextInput!==null){
            searchedTextInput.value = '';
        }  
    }

    handleSearching(event) {        
        this.oldSearchText = this.searchedText;
        const searchText = event.currentTarget.value;
        this.searchedText = searchText;
        if (this.oldSearchText !== this.searchedText) {
            if (this.searchTimer) {
                clearTimeout(this.searchTimer);
            }
            this.searchTimer = setTimeout(() => {
                var start = performance.now();
                this.searchByKey();
                this.toggleLeftRightToSelectApplicable();
                var end = performance.now();
                var timeTaken = end - start;
                console.log('It took ' + timeTaken + ' for searching "' + searchText + '" on the 3 permissions JSON of each sized ' + this.permissionSetActionJSON.length + ' and adding actions back by checking the insert and update map of sizes: ' + this.permissionInsertMap.size + ' & ' + this.permissionUpdateMap.size);

            }, TIMER_DELAY);

        }
    }

    searchByKey(){
        let keyField = '';
                if (this.selectedPermissionType1 === FIELD_PERMISSIONS) {
                    keyField = FIELD_PERMISSION_KEY_FIELD;
                }
                else if (this.selectedPermissionType1 === OBJECT_PERMISSIONS) {
                    keyField = OBJECT_PERMISSION_KEY_FIELD;
                }
                for (let i = 0; i < this.permissionSetActionJSON.length; i++) {
                    if (this.permissionSet1JSON[i][keyField].toUpperCase().indexOf(this.searchedText.toUpperCase()) === -1) {
                        if (this.permissionSet1JSON[i].rowClass.indexOf('search-filtered-hide-row') === -1) {
                            //add search-filtered-hide-row
                            this.permissionSet1JSON[i].rowClass = this.permissionSet1JSON[i].rowClass + ' search-filtered-hide-row';
                            this.permissionSet2JSON[i].rowClass = this.permissionSet2JSON[i].rowClass + ' search-filtered-hide-row';
                            this.permissionSetActionJSON[i].rowClass = this.permissionSetActionJSON[i].rowClass + ' search-filtered-hide-row';
                        }
                    } else {
                        //remove search-filtered-hide-row
                        this.permissionSet1JSON[i].rowClass = this.permissionSet1JSON[i].rowClass.replace(' search-filtered-hide-row', '');
                        this.permissionSet2JSON[i].rowClass = this.permissionSet2JSON[i].rowClass.replace(' search-filtered-hide-row', '');
                        this.permissionSetActionJSON[i].rowClass = this.permissionSetActionJSON[i].rowClass.replace(' search-filtered-hide-row', '');
                    }
                    //setting left/right sync actions back on UI using the inseet/update maps
                    let metLeftOrRight = false;
                    if (this.permissionInsertMap.get(this.permissionSetActionJSON[i].objForSyncingToLeft[keyField])
                        || this.permissionUpdateMap.get(this.permissionSetActionJSON[i].objForSyncingToLeft[keyField])) {
                        this.permissionSetActionJSON[i].actionOptions[0].checked = true;
                        this.permissionSetActionJSON[i].actionOptions[1].checked = false;
                        this.permissionSetActionJSON[i].actionOptions[2].checked = false;
                        metLeftOrRight = true;
                    }
                    if (this.permissionInsertMap.get(this.permissionSetActionJSON[i].objForSyncingToRight[keyField])
                        || this.permissionUpdateMap.get(this.permissionSetActionJSON[i].objForSyncingToRight[keyField])) {
                        this.permissionSetActionJSON[i].actionOptions[0].checked = false;
                        this.permissionSetActionJSON[i].actionOptions[1].checked = false;
                        this.permissionSetActionJSON[i].actionOptions[2].checked = true;
                        metLeftOrRight = true;
                    }
                    if (metLeftOrRight === false) {
                        this.permissionSetActionJSON[i].actionOptions[0].checked = false;
                        this.permissionSetActionJSON[i].actionOptions[1].checked = true;
                        this.permissionSetActionJSON[i].actionOptions[2].checked = false;
                    }

                }
                this.searchTimer = null;
    }

    toggleDropDown() {
        let dropdownAction = this.template.querySelector('[data-id="dropdownAction"]');
        dropdownAction.classList.toggle("slds-is-open");
    }

    //menu button toggles

    initiateToggles(){
        this.toggleShowSelectedBtnText = 'Show Only Selected';
        this.toggleAllLeftSyncBtnText = 'Select Applicable to Left';
        this.toggleAllRightSyncBtnText = 'Select Applicable to Right';
    }

    handleToggleShowSelected(event) {
        if (this.searchTimer) {
            clearTimeout(this.searchTimer);
        }
        this.searchTimer = setTimeout(() => {
            var start = performance.now();
            this.toggleShowAllOrSelected();
            this.toggleLeftRightToSelectApplicable();
            this.searchTimer = null;
            var end = performance.now();
            var timeTaken = end - start;
            console.log('It took ' + timeTaken + ' for toggleing to show selected on the 3 permissions JSON of each sized ' + this.permissionSetActionJSON.length + ' and adding actions back by checking the insert and update map of sizes: ' + this.permissionInsertMap.size + ' & ' + this.permissionUpdateMap.size);
            this.searchByKey();
        }, TIMER_DELAY);
    }

    toggleShowAllOrSelected(){
        let keyField = '';
            if (this.selectedPermissionType1 === FIELD_PERMISSIONS) {
                keyField = FIELD_PERMISSION_KEY_FIELD;
            }
            else if (this.selectedPermissionType1 === OBJECT_PERMISSIONS) {
                keyField = OBJECT_PERMISSION_KEY_FIELD;
            }
            for (let i = 0; i < this.permissionSetActionJSON.length; i++) {
                //setting left/right sync actions back on UI using the inseet/update maps
                let metLeftOrRight = false;
                if (this.toggleShowSelectedBtnText === 'Show Only Selected') {
                    if (this.permissionInsertMap.get(this.permissionSetActionJSON[i].objForSyncingToLeft[keyField])
                        || this.permissionUpdateMap.get(this.permissionSetActionJSON[i].objForSyncingToLeft[keyField])) {
                        this.permissionSetActionJSON[i].actionOptions[0].checked = true;
                        this.permissionSetActionJSON[i].actionOptions[1].checked = false;
                        this.permissionSetActionJSON[i].actionOptions[2].checked = false;
                        metLeftOrRight = true;
                    }
                    if (this.permissionInsertMap.get(this.permissionSetActionJSON[i].objForSyncingToRight[keyField])
                        || this.permissionUpdateMap.get(this.permissionSetActionJSON[i].objForSyncingToRight[keyField])) {
                        this.permissionSetActionJSON[i].actionOptions[0].checked = false;
                        this.permissionSetActionJSON[i].actionOptions[1].checked = false;
                        this.permissionSetActionJSON[i].actionOptions[2].checked = true;
                        metLeftOrRight = true;
                    }
                    if (metLeftOrRight === false) {
                        this.permissionSetActionJSON[i].actionOptions[0].checked = false;
                        this.permissionSetActionJSON[i].actionOptions[1].checked = true;
                        this.permissionSetActionJSON[i].actionOptions[2].checked = false;
                        //didn't meet both left and right selection
                        this.permissionSet1JSON[i].rowClass = this.permissionSet1JSON[i].rowClass + ' unselected-hide-row';
                        this.permissionSet2JSON[i].rowClass = this.permissionSet2JSON[i].rowClass + ' unselected-hide-row';
                        this.permissionSetActionJSON[i].rowClass = this.permissionSetActionJSON[i].rowClass + ' unselected-hide-row';
                    } else {
                        //atleast met left or right slection
                        this.permissionSet1JSON[i].rowClass = this.permissionSet1JSON[i].rowClass.replace(' unselected-hide-row', '');
                        this.permissionSet2JSON[i].rowClass = this.permissionSet2JSON[i].rowClass.replace(' unselected-hide-row', '');
                        this.permissionSetActionJSON[i].rowClass = this.permissionSetActionJSON[i].rowClass.replace(' unselected-hide-row', '');

                    }
                }
                else if (this.toggleShowSelectedBtnText === 'Show All') {
                    if (this.permissionInsertMap.get(this.permissionSetActionJSON[i].objForSyncingToLeft[keyField])
                        || this.permissionUpdateMap.get(this.permissionSetActionJSON[i].objForSyncingToLeft[keyField])) {
                        this.permissionSetActionJSON[i].actionOptions[0].checked = true;
                        this.permissionSetActionJSON[i].actionOptions[1].checked = false;
                        this.permissionSetActionJSON[i].actionOptions[2].checked = false;
                        metLeftOrRight = true;
                    }
                    if (this.permissionInsertMap.get(this.permissionSetActionJSON[i].objForSyncingToRight[keyField])
                        || this.permissionUpdateMap.get(this.permissionSetActionJSON[i].objForSyncingToRight[keyField])) {
                        this.permissionSetActionJSON[i].actionOptions[0].checked = false;
                        this.permissionSetActionJSON[i].actionOptions[1].checked = false;
                        this.permissionSetActionJSON[i].actionOptions[2].checked = true;
                        metLeftOrRight = true;
                    }
                    if (metLeftOrRight === false) {
                        this.permissionSetActionJSON[i].actionOptions[0].checked = false;
                        this.permissionSetActionJSON[i].actionOptions[1].checked = true;
                        this.permissionSetActionJSON[i].actionOptions[2].checked = false;
                    }
                    this.permissionSet1JSON[i].rowClass = this.permissionSet1JSON[i].rowClass.replace(' unselected-hide-row', '');
                    this.permissionSet2JSON[i].rowClass = this.permissionSet2JSON[i].rowClass.replace(' unselected-hide-row', '');
                    this.permissionSetActionJSON[i].rowClass = this.permissionSetActionJSON[i].rowClass.replace(' unselected-hide-row', '');
                }
            }
            if (this.toggleShowSelectedBtnText === 'Show Only Selected') {
                this.toggleShowSelectedBtnText = 'Show All';
            } else if (this.toggleShowSelectedBtnText === 'Show All') {
                this.toggleShowSelectedBtnText = 'Show Only Selected';
            }            
    }

    toggleToShowAll(){
        if (this.toggleShowSelectedBtnText === 'Show All') {
            this.toggleShowAllOrSelected();
        }
    }
    
    handleSyncAllLeft(event) {
        for (let i = 0; i < this.permissionSetActionJSON.length; i++) {
            if (this.toggleAllLeftSyncBtnText === 'Select Applicable to Left') {
                if (this.permissionSetActionJSON[i].disableLeftSync === false 
                    && this.permissionSetActionJSON[i].class.indexOf('hide')===-1
                    && this.permissionSetActionJSON[i].rowClass.indexOf('hide-row') === -1
                    ) {
                    this.deleteInsertAndUpdateRecord(this.permissionSetActionJSON[i].key);
                    this.loadInsertOrUpdateRecord(this.permissionSetActionJSON[i].key, this.permissionSetActionJSON[i].objForSyncingToLeft);
                    this.permissionSetActionJSON[i].actionOptions[0].checked = true;
                    this.permissionSetActionJSON[i].actionOptions[1].checked = false;
                    this.permissionSetActionJSON[i].actionOptions[2].checked = false;
                }
            } else if (this.toggleAllLeftSyncBtnText === 'Unselect Left Selections' 
                && this.permissionSetActionJSON[i].class.indexOf('hide')===-1
                && this.permissionSetActionJSON[i].rowClass.indexOf('hide-row') === -1
                ) {
                this.deleteInsertAndUpdateRecord(this.permissionSetActionJSON[i].key);
                this.permissionSetActionJSON[i].actionOptions[0].checked = false;
                this.permissionSetActionJSON[i].actionOptions[1].checked = true;
                this.permissionSetActionJSON[i].actionOptions[2].checked = false;
                //if Show Only Selected then toggle it to Show All
                this.toggleToShowAll();
            }            
        }

        if (this.toggleAllLeftSyncBtnText === 'Select Applicable to Left') {
            this.toggleAllLeftSyncBtnText = 'Unselect Left Selections';
        } else if (this.toggleAllLeftSyncBtnText === 'Unselect Left Selections') {
            this.toggleAllLeftSyncBtnText = 'Select Applicable to Left';
        }

        this.updateSelectionCountBadge();
    }

    handleSyncAllRight(event) {
        for (let i = 0; i < this.permissionSetActionJSON.length; i++) {
            if (this.toggleAllRightSyncBtnText === 'Select Applicable to Right') {
                if (this.permissionSetActionJSON[i].disableRightSync === false 
                    && this.permissionSetActionJSON[i].class.indexOf('hide')===-1
                    && this.permissionSetActionJSON[i].rowClass.indexOf('hide-row') === -1
                    ) {
                    this.deleteInsertAndUpdateRecord(this.permissionSetActionJSON[i].key);
                    this.loadInsertOrUpdateRecord(this.permissionSetActionJSON[i].key, this.permissionSetActionJSON[i].objForSyncingToRight);
                    this.permissionSetActionJSON[i].actionOptions[0].checked = false;
                    this.permissionSetActionJSON[i].actionOptions[1].checked = false;
                    this.permissionSetActionJSON[i].actionOptions[2].checked = true;
                }
            } else if (this.toggleAllRightSyncBtnText === 'Unselect Right Selections' 
                && this.permissionSetActionJSON[i].class.indexOf('hide')===-1
                && this.permissionSetActionJSON[i].rowClass.indexOf('hide-row') === -1                
                ) {
                this.deleteInsertAndUpdateRecord(this.permissionSetActionJSON[i].key);
                this.permissionSetActionJSON[i].actionOptions[0].checked = false;
                this.permissionSetActionJSON[i].actionOptions[1].checked = true;
                this.permissionSetActionJSON[i].actionOptions[2].checked = false;
                //if Show Only Selected then toggle it to Show All
                this.toggleToShowAll();
            }
        }

        if (this.toggleAllRightSyncBtnText === 'Select Applicable to Right') {
            this.toggleAllRightSyncBtnText = 'Unselect Right Selections';
        } else if (this.toggleAllRightSyncBtnText === 'Unselect Right Selections') {
            this.toggleAllRightSyncBtnText = 'Select Applicable to Right';
        }

        this.updateSelectionCountBadge();
    }

    toggleLeftRightToSelectApplicable(){
        //left
        if (this.toggleAllLeftSyncBtnText === 'Unselect Left Selections') {
            this.toggleAllLeftSyncBtnText = 'Select Applicable to Left';
        }
        //right
        if (this.toggleAllRightSyncBtnText === 'Unselect Right Selections') {
            this.toggleAllRightSyncBtnText = 'Select Applicable to Right';
        }
    }

    handleDiffBothMatchFocus(event){
        let currentTarget = event.currentTarget;
        currentTarget.previousSibling.checked = true;
        this.toggleDIffBothMatch(currentTarget.previousSibling.value);
    }

    handleDiffBothMatchChange(event){
        event.preventDefault();
        event.currentTarget.checked = true;
        const selectedOption = event.currentTarget.value;
        this.toggleDIffBothMatch(selectedOption);
    }

    toggleDIffBothMatch(selectedValue){
        this.searchTimer = setTimeout(() => {
            var start = performance.now();
            let keyField = '';
            if (this.selectedPermissionType1 === FIELD_PERMISSIONS) {
                keyField = FIELD_PERMISSION_KEY_FIELD;
            }
            else if (this.selectedPermissionType1 === OBJECT_PERMISSIONS) {
                keyField = OBJECT_PERMISSION_KEY_FIELD;
            }
            for (let i = 0; i < this.permissionSetActionJSON.length; i++) {
                //setting left/right sync actions back on UI using the inseet/update maps
                let metLeftOrRight = false;
                if (selectedValue === 'Diff') {
                    if (this.permissionSet1JSON[i].class.indexOf('green')!==-1){
                        this.permissionSet1JSON[i].rowClass = this.permissionSet1JSON[i].rowClass + ' match-hide-row';
                        this.permissionSet2JSON[i].rowClass = this.permissionSet2JSON[i].rowClass + ' match-hide-row';
                        this.permissionSetActionJSON[i].rowClass = this.permissionSetActionJSON[i].rowClass + ' match-hide-row';
                    }
                    if (this.permissionSet1JSON[i].class.indexOf('red')!==-1){
                        this.permissionSet1JSON[i].rowClass = this.permissionSet1JSON[i].rowClass.replace(' diff-hide-row', '');
                        this.permissionSet2JSON[i].rowClass = this.permissionSet2JSON[i].rowClass.replace(' diff-hide-row', '');
                        this.permissionSetActionJSON[i].rowClass = this.permissionSetActionJSON[i].rowClass.replace(' diff-hide-row', '');
                    }
                }
                else if (selectedValue === 'Both') {
                    if (this.permissionSet1JSON[i].class.indexOf('green')!==-1){
                        this.permissionSet1JSON[i].rowClass = this.permissionSet1JSON[i].rowClass.replace(' match-hide-row', '');
                        this.permissionSet2JSON[i].rowClass = this.permissionSet2JSON[i].rowClass.replace(' match-hide-row', '');
                        this.permissionSetActionJSON[i].rowClass = this.permissionSetActionJSON[i].rowClass.replace(' match-hide-row', '');
                    }
                    if (this.permissionSet1JSON[i].class.indexOf('red')!==-1){
                        this.permissionSet1JSON[i].rowClass = this.permissionSet1JSON[i].rowClass.replace(' diff-hide-row', '');
                        this.permissionSet2JSON[i].rowClass = this.permissionSet2JSON[i].rowClass.replace(' diff-hide-row', '');
                        this.permissionSetActionJSON[i].rowClass = this.permissionSetActionJSON[i].rowClass.replace(' diff-hide-row', '');
                    }
                }
                else if (selectedValue === 'Match') {
                    if (this.permissionSet1JSON[i].class.indexOf('green')!==-1){
                        this.permissionSet1JSON[i].rowClass = this.permissionSet1JSON[i].rowClass.replace(' match-hide-row', '');
                        this.permissionSet2JSON[i].rowClass = this.permissionSet2JSON[i].rowClass.replace(' match-hide-row', '');
                        this.permissionSetActionJSON[i].rowClass = this.permissionSetActionJSON[i].rowClass.replace(' match-hide-row', '');
                    }
                    if (this.permissionSet1JSON[i].class.indexOf('red')!==-1){
                        this.permissionSet1JSON[i].rowClass = this.permissionSet1JSON[i].rowClass + ' diff-hide-row';
                        this.permissionSet2JSON[i].rowClass = this.permissionSet2JSON[i].rowClass + ' diff-hide-row';
                        this.permissionSetActionJSON[i].rowClass = this.permissionSetActionJSON[i].rowClass + ' diff-hide-row';
                    }
                }
            }
            this.searchTimer = null;
            var end = performance.now();
            var timeTaken = end - start;
            console.log('It took ' + timeTaken + ' for toggleing to show selected on the 3 permissions JSON of each sized ' + this.permissionSetActionJSON.length + ' and adding actions back by checking the insert and update map of sizes: ' + this.permissionInsertMap.size + ' & ' + this.permissionUpdateMap.size);
        }, TIMER_DELAY);
    }

    contains(string1, string2) {
        return string1.indexOf(string2) === -1 ? false : true;
    }

    //cast string undefined/null with empty string
    getStringDefault(value) {
        if (value === undefined || value === null) {
            return '';
        }
        return value;
    }

}