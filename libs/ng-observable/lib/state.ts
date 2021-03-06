import { ChangeDetectorRef, Inject, Injectable, OnDestroy, Optional, Self } from "@angular/core"
import { asapScheduler, BehaviorSubject } from "rxjs"
import { throttleTime } from "rxjs/operators"
import { StreamSink } from "./stream-sink"
import { STATE_CHANGE_STRATEGY, StateChangeStrategy } from "./constants"

export class State<T extends object> extends BehaviorSubject<T> {
    public readonly next: (partialState?: Partial<T>) => void
    public readonly patchValue: (partialState?: Partial<T>) => void
    private readonly valueRef: T

    constructor(valueRef: T) {
        super(Object.create(valueRef))

        this.valueRef = valueRef

        this.next = (partialState?: Partial<T>) => {
            this.patchValue(partialState)
            super.next(Object.create(valueRef))
        }

        this.patchValue = (partialState?: Partial<T>) => {
            if (!partialState || valueRef.isPrototypeOf(partialState as any)) {
                return
            }
            Object.assign(valueRef, partialState)
        }
    }
}

@Injectable({ providedIn: "root" })
export class StateFactory<T extends Object> implements OnDestroy {
    private readonly stream: StreamSink
    private readonly strategy: StateChangeStrategy
    private readonly cdr?: ChangeDetectorRef
    constructor(
        @Inject(STATE_CHANGE_STRATEGY) strategy: StateChangeStrategy,
        @Optional() cdr?: ChangeDetectorRef,
    ) {
        this.stream = new StreamSink()
        this.cdr = cdr
        this.strategy = strategy
    }

    public create(value: T): State<T> {
        const { cdr, strategy } = this
        const state = new State(value)

        if (cdr) {
            if (strategy === StateChangeStrategy.DETACH) {
                Promise.resolve().then(() => cdr.detach())
                this.stream.sink = throttleTime(0, asapScheduler, { trailing: true })(
                    state,
                ).subscribe(() => {
                    cdr.detectChanges()
                    cdr.checkNoChanges()
                })
            } else {
                cdr.reattach()
            }
        }

        return state
    }

    public ngOnDestroy() {
        this.stream.complete()
    }
}
