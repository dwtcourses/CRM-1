// External imports
import { Component, OnInit, ViewContainerRef, ChangeDetectorRef, ChangeDetectionStrategy, NgZone, PipeTransform, Pipe,ViewChildren,QueryList } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import * as  moment from 'moment-timezone';
import * as _ from 'lodash';
// Internal imports
import { UserService, DialogService, MessageService, CDRService, LocalStorageUtilityService } from '@app/shared/services';
import { DailyViewService } from '@app/training-planner/daily-view/daily-view.service';
import { AssignTrainerComponent } from '@app/training-planner/dialogs/assign-trainer/assign-trainer.component';
import { CreateSlotComponent } from '@app/training-planner/dialogs/create-slot/create-slot.component';
import { WeeklyPlanComponent } from '@app/training-planner/dialogs/weekly-plan/weekly-plan.component';
import { TrainingPlannerTemplateComponent } from '@app/training-planner/dialogs/training-planner-template/training-planner-template.component';
import { TicketActivityOverlayService } from '@app/ticket-activity/ticket-activity-overlay.service';


@Component({
  selector: 'app-daily-view',
  templateUrl: './daily-view.component.html',
  styleUrls: ['./daily-view.component.scss'],

})
export class DailyViewComponent implements OnInit {

  @ViewChildren('windowTitleBar') windowTitleBar: QueryList<any>;

  public dailyViewForm: FormGroup;
  public date: any;
  public showInfo = false;
  public weekDayName: string; // holds week day name
  public userDetails: any; // holds userDetails
  public startRefresh = false; // to start refresh button
  public isFuture: boolean; // holds future date or not
  public diffTime: any = 1; // holds differnce of time
  public diffFormat = 'hours'; // time format 
  public workingHourStart = '08:00'; // working hour start
  public workingHourEnd = '20:00'; // working hour end
  public trainningPlannerSearch: any = {};
  public statisticsData: any = {
    'nonbooked': 0,
    'booked': 0,
    'assigned': {
      'Completed': 0,
      'Cancelled': 0,
      'Rescheduled': 0,
      'NoShow': 0,
      'Total': 0
    },
    'empty': 0
  };
  public agentNames: any = []; // hold agent names
  public preservePlanDetails: any = []; // to store plan details
  public detailsData: any = {}; // holds details data
  public templateData: any; // hold template data
  public selectedActivityID: any = []; // holds selected activity id
  public purposeList: Array<any> = [{ id: 'VIP', name: 'VIP' }, { id: 'New Sale', name: 'New Sale' }, { id: 'Renewal', name: 'Renewal' }, { id: 'Renewal not used', name: 'Renewal not used' }]; // holds purpose list

  constructor(private fb: FormBuilder, private ngZone: NgZone, private localStorageUtilityService: LocalStorageUtilityService, private cdr: ChangeDetectorRef, private cdrService: CDRService, private messageService: MessageService, private viewContainerRef: ViewContainerRef, private dialogService: DialogService, private userService: UserService, private dailyViewService: DailyViewService,
    private ticketActivityOverlayService: TicketActivityOverlayService,) { }



  /**
   * @author Mansi Makwana
   * @createdDate 27-11-2019
   * @discription to create daily view form
   * @memberOf PredictiveDialerManageComponent
   */
  public initDailyViewForm() {
    this.dailyViewForm = this.fb.group({
      startDate: [this.date],
    });
    this.cdr.detectChanges();
  }

  /**
   * @author Mansi Makwana
   * @createdDate 27-11-2019
   * @discription to open  training-planner-template dialog
   * @memberOf PredictiveDialerManageComponent
   */
  openTemplateDialog() {
    this.dialogService.custom(TrainingPlannerTemplateComponent, { 'data': this.templateData }, { 'keyboard': true, 'backdrop': 'static', 'size': 'lg' })
      .result.then((result) => {
      }, (error) => {
        console.error(error);
      });
    this.cdr.detectChanges();
  }

  /**
   * @author Mansi Makwana
   * @createdDate 27-11-2019
   * @discription to open  create slot dialog
   * @memberOf PredictiveDialerManageComponent
   */
  openTimeSlotDialog(type, data, time) {
    this.dialogService.custom(CreateSlotComponent, {
      'data': { type: type, time: time, date: moment(this.dailyViewForm.controls.startDate.value).format().split("T")[0], slotDetails: data, purposeList: this.purposeList }
    }, { 'keyboard': true, 'backdrop': 'static', 'size': 'lg' }).result.then((response: any) => {

      this.getTrainingPlan();
    }, (error) => {
      console.error(error);
    });
    this.cdr.detectChanges();
  }


  /**
   * @author om kanada
   * @description
   *        This function is used to get Training data from API.
   * @memberof DailyViewComponent
   */
  public getTrainingPlan(): void {
    this.startRefresh = true;
    let param: any = {};
    param.startDate = moment(this.dailyViewForm.controls.startDate.value).set({ hour: 12, minute: 0, second: 0, millisecond: 0 }).utc().format();
    this.dailyViewService.getTrainingPlan(param).then((response) => {
      const selected = moment(this.dailyViewForm.controls.startDate.value).set({ hour: 12, minute: 0, second: 0, millisecond: 0 }).utc().format();
      const todays = moment().set({ hour: 12, minute: 0, second: 0, millisecond: 0 }).utc().format();
      this.isFuture = selected >= todays;
      let statistics = {
        'nonbooked': 0,
        'booked': 0,
        'assigned': {
          'Completed': 0,
          'Cancelled': 0,
          'Rescheduled': 0,
          'NoShow': 0,
          'Total': 0
        },
        'empty': 0
      };

      for (let obj of response) {
        if (obj.id && obj.customerId && obj.activityId && obj.trainerId) {
          obj.slotType = 'assigned'
        } else if (obj.id && obj.customerId && obj.activityId && !obj.trainerId) {
          obj.slotType = 'booked'
        } else if (obj.id && !(obj.customerId || obj.activityId || obj.trainerId)) {
          obj.slotType = 'nonbooked'
        } else {
          obj.slotType = 'empty';
        }

        if (obj.slotType === 'assigned') {
          if (obj.status === 'Completed') {
            obj.priority = 2;
          } else if (obj.status === 'Cancelled') {
            obj.priority = 3;
          } else if (obj.status === 'Rescheduled') {
            obj.priority = 4;
          } else if (obj.status === 'No Show Up' || obj.status === 'No Show') {
            obj.status = 'No Show'
            obj.priority = 5;
          } else {
            obj.priority = 1;
          }
          if (obj.status) {
            if (obj.status === 'No Show Up' || obj.status === 'No Show') {
              statistics[obj.slotType]['NoShow'] += 1;
            } else {
              statistics[obj.slotType][obj.status] += 1;
            }
          }
          statistics[obj.slotType]['Total'] += 1;
        } else {
          statistics[obj.slotType] += 1;
          obj.priority = 0
        }
      }
      statistics['assigned']['Total'] = statistics['assigned']['Total'] - (statistics['assigned']['Completed'] + statistics['assigned']['Cancelled'] + statistics['assigned']['Rescheduled'] + statistics['assigned']['NoShow']);

      //  response.sort((a, b) => 0 - (a.slotType > b.slotType ? -1 : 1));
      response = _.sortBy(response, (obj) => { return obj.slotType });
      this.statisticsData = statistics;
      if (!(selected >= todays)) {
        // Removed Empty Slots for the Past
        _.remove(response, (obj) => { return obj.slotType === 'nonbooked' });
      }


      const workstart = moment().format('YYYY-MM-DD') + " " + this.workingHourStart;
      const workend = moment().format('YYYY-MM-DD') + " " + this.workingHourEnd;
      let workstartUTC = moment.tz(workstart, 'YYYY-MM-DD HH:mm', 'America/New_York').utc().format();
      const workendUTC = moment.tz(workend, 'YYYY-MM-DD HH:mm', 'America/New_York').utc().format();
      const planData = {};

      for (let i = 1; moment(workstartUTC) <= moment(workendUTC); i++) {
        const tempStoreDate = workstartUTC;
        planData[moment(workstartUTC).tz('America/New_York').format('hh:mm A')] = [];
        workstartUTC = moment.tz(workstart, 'YYYY-MM-DD HH:mm', 'America/New_York').add(this.diffTime * i, this.diffFormat).utc().format();
        if (response && response.length > 0) {
          response.forEach(element => {
            element.agentName = element.trainerName ? element.trainerName : 'tempNamed';
          });
          planData[moment(tempStoreDate).tz('America/New_York').format('hh:mm A')] = response.filter(t => {
            const tempDate = moment.tz(moment().format('YYYY-MM-DD') + " " + t.time, 'YYYY-MM-DD hh:mm A', 'America/New_York').utc().format();
            return moment(tempDate) >= moment(tempStoreDate) && moment(tempDate) < moment(workstartUTC);
          });
        } else {
          planData[moment(tempStoreDate).tz('America/New_York').format('hh:mm A')] = [];
        }
      }
      let maxSize = 0;
      for (const key in planData) {
        if (planData[key].length > maxSize) {
          maxSize = planData[key].length;
        }
      }
      // tslint:disable-next-line:forin
      for (const key in planData) {
        const currentLength = planData[key].length;
        for (let i = currentLength; i < maxSize; i++) {
          planData[key].push({ agentName: 'tempNamed' });
        }
      }
      const finalObj = {};
      this.agentNames = [];
      // tslint:disable-next-line:forin
      for (const time in planData) {
        for (const obj of planData[time]) {
          if (this.agentNames.indexOf(obj.agentName) === -1 && obj.agentName !== 'Unnamed') {
            this.agentNames.push(obj.agentName);
          }
        }
      }

      this.agentNames = _.sortBy(this.agentNames, (value) => {
        return value.toLowerCase();
      });
      this.agentNames.push("tempNamed");

      let maxUnnamedLength = 0;

      // tslint:disable-next-line:forin
      for (const time in planData) {
        finalObj[time] = {};
        for (const agent of this.agentNames) {
          finalObj[time][agent] = planData[time].filter(t => t.agentName === agent);

          if (agent === 'tempNamed') {
            // tslint:disable-next-line:forin
            for (const index in finalObj[time]['tempNamed']) {
              const id = parseInt(index, 0) + 1;
              finalObj[time]['tempNamed'][index].agentName = "Unnamed" + id;
            }

            if (maxUnnamedLength < finalObj[time][agent].length) {
              maxUnnamedLength = finalObj[time][agent].length;
            }
          }
        }
      }

      for (let i = 0; i < maxUnnamedLength; i++) {
        this.agentNames.push("Unnamed" + (i + 1));
      }

      for (const time in planData) {
        finalObj[time] = {};
        for (const agent of this.agentNames) {
          finalObj[time][agent] = planData[time].filter(t => t.agentName === agent);
        }
      }
      _.remove(this.agentNames, (value) => {
        return value === 'tempNamed';
      });

      // tslint:disable-next-line:forin
      for (const time in finalObj) {
        delete finalObj[time]['tempNamed'];
      }


      const agentToRemove = [];

      for (const agent of this.agentNames) {
        let len = 0;
        // tslint:disable-next-line:forin
        for (const time in finalObj) {
          _.remove(finalObj[time][agent], (obj) => {
            return Object.keys(obj).length <= 1;
          });
          if (finalObj[time][agent].length > len) {
            len = finalObj[time][agent].length;
          }
        }
        if (len === 0) {
          agentToRemove.push(agent);
        }
      }

      for (const agent of agentToRemove) {
        _.remove(this.agentNames, (value) => {
          return value === agent;
        });
      }

      for (const agent of this.agentNames) {
        // tslint:disable-next-line:forin
        for (const time in finalObj) {
          finalObj[time][agent] = _.sortBy(finalObj[time][agent], (obj) => {
            return obj.priority;
          });
        }
      }
      this.preservePlanDetails = response;
      this.detailsData = finalObj;

      this.startRefresh = false;
    },(error)=>{
      console.error(error);
      this.startRefresh = false;
    });
    this.cdr.detectChanges();
  }

  /**
   * @author om kanada
   * @description
   *        This function is used to get Training Template from API.
   * @memberof DailyViewComponent
   */
  getTrainingTemplate(): void {
    this.dailyViewService.getTrainingTemplate().then(response => {
      if (response) {
        this.templateData = response;
      }
    }, (error) => {
      console.log(error);
    });
    this.cdr.detectChanges();
  }

  /**
   * @author om kanada
   * @description
   *        call when date is changed.
   * @memberof DailyViewComponent
   */
  dateChange(event: any, action?: any): void {
    this.weekDayName = moment(this.dailyViewForm.controls.startDate.value).format('dddd');
    if (action === 'search') {

    } else if (action === 'previous') {
      this.dailyViewForm.controls.startDate.setValue(moment(this.dailyViewForm.controls.startDate.value).subtract(1, 'days').format());
      this.weekDayName = moment(this.dailyViewForm.controls.startDate.value).format('dddd');
    } else if (action === 'next') {
      this.dailyViewForm.controls.startDate.setValue(moment(this.dailyViewForm.controls.startDate.value).add(1, 'days').format());
      this.weekDayName = moment(this.dailyViewForm.controls.startDate.value).format('dddd');
    }
    this.getTrainingPlan();
    this.cdr.detectChanges();
  }




  /**
   * @author om kanada
   * @param details 
   *        object type combination of date,id,activityId
   * @description
   *        unassign trainer.
   * @memberof DailyViewComponent
   */
  unAssignTrainer(details): void {
    const dialogData = { title: 'Confirmation', text: 'Are you sure, you want to unassign the trainer?' };
    this.dialogService.confirm(dialogData, {}).result.then((res) => {
      if (res === 'YES') {
        // Call unassign api to unassign trainer
        const tempDate = details.date + ' ' + '12:00:00';
        const date = moment.tz(tempDate, 'YYYY-MM-DD HH:mm:ss', 'America/New_York').utc().format();
        const obj = { date: date, id: details.id, activityId: details.activityId };
        this.dailyViewService.unAssignTrainer(obj).then((result) => {

          this.getTrainingPlan();
          this.messageService.showMessage('Trainer Unassigned Successfully', 'success');

        });
      }
      this.cdr.detectChanges();
    }, error => {
      console.error('ERROR  : ' + error);
    });
  }

  /**
   * @author om kanada
   * @param details 
   *        object type combination of date,id,time.
   * @description
   *        delete slot.
   * @memberof DailyViewComponent
   */
  public deleteData(details: any): void {
    // Open confirm dialog for user Confirmation
    const dialogData = { title: 'Confirmation', text: 'Are you sure, you want to delete the slot?' };
    this.dialogService.confirm(dialogData, {}).result.then((res) => {
      // If user press ok
      if (res === 'YES') {
        const data = {
          "id": details.id,
          "date": details.date,
          "time": details.time,
        };
        // Call delete api to delete 
        this.dailyViewService.deleteData(data).then(
          (result) => {
            this.getTrainingPlan();
            this.messageService.showMessage('Slot Deleted Successfully', 'success');
          });
      }
      this.cdr.detectChanges();
    }, error => {
      console.error('ERROR  : ' + error);
    });
  }


  /**
   * @author om kanada
   * @param activityId 
   *        holds activity id.
   * @description
   *        open activity.
   * @memberof DailyViewComponent
   */
  public openActivity(activityId): void {
    this.selectedActivityID = this.localStorageUtilityService.getFromLocalStorage('selectedActivityIds');
    if (this.selectedActivityID === undefined || this.selectedActivityID === null) {
      this.selectedActivityID = [];
    }
    const isExists = this.selectedActivityID.findIndex(t => t.activityId === activityId);
    if (isExists === -1) {
     this.setSelectedActivityId({ currentActivityId: { activityId: activityId, screen: 'activity' } });
      let dialogData ={id: activityId, screen: 'activity', searchActivityData: { data: [] },flag:true}
      this.ticketActivityOverlayService.openWindow(dialogData);

    } else {
      this.messageService.showMessage('Activity Already Open', 'error');
      this.ticketActivityOverlayService.maximizeWindow(activityId, 'activity');
      // this.overlayDialogService.setFocus(this.selectedActivityID[isExists].dialogId); ?????
    }
  }

  /**
   * @author om kanada
   * @param activityIdData 
   *        holds activity id data.
   * @description
   *        set selected activity id.
   * @memberof DailyViewComponent
   */
  private setSelectedActivityId(activityIdData) {
    this.ngZone.run(() => {
      //  this.selectedActivityID = this.activityHighlightService.setSelectedActivityId(activityIdData); 
    });
  }


  /**
   * @author om kanada
   * @param details
   *        holds object of details.
   * @param time
   *        holds time.
   * @description
   *        assign trainer.
   * @memberof DailyViewComponent
   */
  public assignTrainer(details, time): void {
    const activeCallDetails = this.localStorageUtilityService.getFromLocalStorage('activeCallDetails');
    if (!details.activityId && activeCallDetails) {
      if (this.userDetails.crmAppConfig.unIdentifiedCustomer.ids.includes(activeCallDetails.customerID) === false) {
        this.dialogService.custom(AssignTrainerComponent, {
          data: { date: this.dailyViewForm.controls.startDate.value, time: time, details: details, activeCallDetails: activeCallDetails, purposeList: this.purposeList }
        }, { 'keyboard': true, 'backdrop': 'static', 'size': 'lg' }).result.then((response: any) => {
          
          this.getTrainingPlan();

        }, (error) => {
          console.error(error);
        });
      } else {
        this.messageService.showMessage('We are unable to Identified the Customer', 'error');
      }
    } else if (details.activityId) {
      this.dialogService.custom(AssignTrainerComponent, {
        data: { date: this.dailyViewForm.controls.startDate.value, time: time, details: details, activeCallDetails: { customerID: details.customerId, phoneNumber: details.phoneNumber, contactPersonId: [details.contactId] } }
      }, { 'keyboard': true, 'backdrop': 'static', 'size': 'lg' }).result.then((response: any) => {
        
        this.getTrainingPlan();
      }, (error) => {
        console.error(error);
      });
    } else {
      this.messageService.showMessage('No Active Call found or Unable to Identify Customer Details, you can go to customer card in order to book appointment manually', 'error');
    }

  }


  /**
   * @author om kanada
   * @description
   *        weekly plan.
   * @memberof DailyViewComponent
   */
  public weeklyPlan(): void {
    this.dialogService.custom(WeeklyPlanComponent, {
      data: { 'id': 'id', 'type': 'weeklyplan' }
    }, { 'keyboard': true, 'backdrop': 'static', 'size': 'md' }).result.then(
      (response: any) => {
        if (response) {
          this.getTrainingPlan();
        }
        this.cdr.detectChanges();
      },
      (error) => {
        console.error(error);
      });
  }


  /**
   * @author om kanada
   * @description
   *        This function is used to get Training Template from API.
   * @memberof DailyViewComponent
   */
  protected dialogClose(): void {
    // self.subscriptionCloseUnsubscribe = self.overlayDialogService.onCloseEvent.subscribe(data => { ?????
    //   this.getTrainingPlan();
    // });
  }

  ngOnInit() {
    this.date = moment().set({ hour: 12, minute: 0, second: 0, millisecond: 0 }).utc().format();
    this.weekDayName = moment().utc().format('dddd');
    this.userDetails = this.userService.getUserDetail();
    this.initDailyViewForm();
    this.getTrainingPlan();
    this.getTrainingTemplate();
    this.dialogClose();


  }

}
// Pipes filtered keys 
@Pipe({ name: 'keys' })
export class KeysPipe implements PipeTransform {
  transform(value: any): any {
    const keys = [];
    for (const key in value) {
      if (value.hasOwnProperty(key)) {
        keys.push(key);
      }
    }
    return keys;
  }
}
