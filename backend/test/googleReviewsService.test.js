import assert from "node:assert/strict";
import test from "node:test";
import { createGoogleReviewsService, GOOGLE_REVIEWS_FIELD_MASK } from "../src/services/googleReviewsService.js";

test("missing Google credentials returns a truthful unavailable state", async () => {
  const diagnostics=[];
  const result = await createGoogleReviewsService({ apiKey:"", placeId:"", timeoutMs:100, cacheTtlMs:1000 }, async () => { throw new Error("must not fetch"); }, {warn:(...args)=>diagnostics.push(args)})();
  assert.deepEqual(result, { available:false, reason:"not_configured", message:"Google Reviews are currently unavailable." });
  assert.equal(diagnostics.length,1);
});

test("successful Place Details response is normalized and cached", async () => {
  let calls=0;let captured;
  const service=createGoogleReviewsService({apiKey:"synthetic-key",placeId:"synthetic-place",timeoutMs:1000,cacheTtlMs:60000},async(url,options)=>{calls+=1;captured={url,options};return{ok:true,json:async()=>({displayName:{text:"Synthetic Dental Clinic"},rating:4.8,userRatingCount:24,googleMapsUri:"https://maps.google.com/?cid=synthetic",reviews:[{authorAttribution:{displayName:"Synthetic Reviewer",uri:"https://www.google.com/maps/contrib/synthetic"},rating:5,text:{text:"Synthetic review text."},relativePublishTimeDescription:"a week ago",publishTime:"2026-08-01T00:00:00Z"}]})};});
  const first=await service(),second=await service();assert.equal(calls,1);assert.deepEqual(second,first);assert.equal(first.placeName,"Synthetic Dental Clinic");assert.equal(first.reviews[0].reviewerName,"Synthetic Reviewer");assert.equal(captured.options.headers["X-Goog-FieldMask"],GOOGLE_REVIEWS_FIELD_MASK);assert.ok(captured.url.endsWith("synthetic-place"));assert.equal("raw" in first,false);
  assert.equal(first.googleMapsUrl,"https://maps.google.com/?cid=synthetic");
  assert.equal(first.reviews[0].reviewerUrl,"https://www.google.com/maps/contrib/synthetic");
});

test("successful response with no review excerpts is not fabricated",async()=>{const result=await createGoogleReviewsService({apiKey:"synthetic-key",placeId:"synthetic-place",timeoutMs:100,cacheTtlMs:1000},async()=>({ok:true,json:async()=>({displayName:{text:"Synthetic Dental Clinic"},rating:4.7,userRatingCount:12,googleMapsUri:"https://maps.google.com/?cid=synthetic"})}),{warn:()=>{}})();assert.equal(result.available,true);assert.equal(result.totalReviewCount,12);assert.deepEqual(result.reviews,[]);});

test("upstream authorization failure is classified and logged without credentials",async()=>{const diagnostics=[];const result=await createGoogleReviewsService({apiKey:"synthetic-secret-key",placeId:"synthetic-place",timeoutMs:100,cacheTtlMs:1000},async()=>({ok:false,status:403}),{warn:(...args)=>diagnostics.push(args)})();assert.deepEqual(result,{available:false,reason:"upstream_forbidden",message:"Google Reviews are currently unavailable."});assert.equal(JSON.stringify(diagnostics).includes("synthetic-secret-key"),false);});

test("upstream quota failure is classified safely",async()=>{const result=await createGoogleReviewsService({apiKey:"synthetic-key",placeId:"synthetic-place",timeoutMs:100,cacheTtlMs:1000},async()=>({ok:false,status:429}),{warn:()=>{}})();assert.deepEqual(result,{available:false,reason:"upstream_quota",message:"Google Reviews are currently unavailable."});});
